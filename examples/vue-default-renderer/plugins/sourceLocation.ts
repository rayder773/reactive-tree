import { parse } from '@babel/parser'
import MagicString from 'magic-string'
import type { Plugin } from 'vite'

const FACTORY_OPTIONS_ARG: Record<string, number> = {
	state: 1,
	asyncNode: 0,
	input: 0,
	button: 0,
	form: 1,
}

const TRACKED_FACTORIES = new Set(Object.keys(FACTORY_OPTIONS_ARG))

function isLibraryImport(importPath: string): boolean {
	return (
		importPath === 'reactive-tree' ||
		importPath.endsWith('/src') ||
		importPath.endsWith('/src/index')
	)
}

// Generic AST visitor — visits every node depth-first.
function walkAst(node: any, visitor: (node: any) => void): void {
	if (!node || typeof node !== 'object') return
	visitor(node)
	for (const key of Object.keys(node)) {
		if (
			key === 'loc' ||
			key === 'start' ||
			key === 'end' ||
			key === 'extra' ||
			key === 'type'
		)
			continue
		const child = node[key]
		if (Array.isArray(child)) {
			for (const item of child) {
				if (item && typeof item === 'object' && 'type' in item)
					walkAst(item, visitor)
			}
		} else if (child && typeof child === 'object' && 'type' in child) {
			walkAst(child, visitor)
		}
	}
}

export function sourceLocationPlugin(): Plugin {
	return {
		name: 'source-location',
		enforce: 'pre',

		transform(code: string, id: string) {
			if (id.includes('node_modules')) return null
			if (id.endsWith('.vue')) return transformVue(code, id)
			if (id.endsWith('.ts') || id.endsWith('.tsx'))
				return transformTs(code, id)
			return null
		},
	}
}

function transformVue(
	code: string,
	_id: string,
): { code: string; map: any } | null {
	const ms = new MagicString(code)

	// Pass 1: inject :data-source-line on elements with v-inspect
	const vInspectRegex = /(<[a-zA-Z][^\n>]*?\bv-inspect\b[^\n>]*?>)/g
	let match: RegExpExecArray | null
	match = vInspectRegex.exec(code)
	while (match !== null) {
		const line = code.slice(0, match.index).split('\n').length
		ms.appendLeft(
			match.index + match[0].length - 1,
			` :data-source-line="${line}"`,
		)
		match = vInspectRegex.exec(code)
	}

	// Pass 2: inject :__inspectSourceLine on PascalCase components that have :node prop.
	// [^>\/] + \/(?!>) allows '/' in URLs but stops before '/>' so the closing group captures it.
	const componentTagRegex = /<([A-Z][a-zA-Z0-9]*)((?:[^>/]|\/(?!>))*)(\/>|>)/g
	match = componentTagRegex.exec(code)
	while (match !== null) {
		if (match[2].includes(':node=')) {
			const line = code.slice(0, match.index).split('\n').length
			const insertPos = match.index + match[0].length - match[3].length
			ms.appendLeft(insertPos, ` :__inspectSourceLine="${line}"`)
		}
		match = componentTagRegex.exec(code)
	}

	if (!ms.hasChanged()) return null
	return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
}

function transformTs(
	code: string,
	id: string,
): { code: string; map: any } | null {
	let ast: ReturnType<typeof parse>
	try {
		ast = parse(code, {
			sourceType: 'module',
			plugins: ['typescript'],
			attachComment: false,
		})
	} catch {
		return null
	}

	const localToFactory = new Map<string, string>()
	let i18nPluginLocalName: string | null = null
	let defineAsyncLocalName: string | null = null

	for (const node of ast.program.body) {
		if (node.type !== 'ImportDeclaration') continue
		if (!isLibraryImport(node.source.value)) continue
		for (const spec of node.specifiers) {
			if (spec.type !== 'ImportSpecifier') continue
			const imported =
				spec.imported.type === 'Identifier'
					? spec.imported.name
					: spec.imported.value
			if (TRACKED_FACTORIES.has(imported))
				localToFactory.set(spec.local.name, imported)
			if (imported === 'createI18nPlugin') i18nPluginLocalName = spec.local.name
			if (imported === 'defineAsync') defineAsyncLocalName = spec.local.name
		}
	}

	const hasI18nLabelPattern = code.includes('.t.value.')
	if (
		localToFactory.size === 0 &&
		!i18nPluginLocalName &&
		!hasI18nLabelPattern &&
		!defineAsyncLocalName
	)
		return null

	const ms = new MagicString(code)
	const absFile = id

	// ── Pass 1: inject __source into factory option objects ─────────────────────

	if (localToFactory.size > 0) {
		walkAst(ast.program, (node) => {
			if (node.type !== 'CallExpression') return
			if (node.callee.type !== 'Identifier') return
			const factoryName = localToFactory.get(node.callee.name)
			if (!factoryName) return

			const argIndex = FACTORY_OPTIONS_ARG[factoryName]
			const args: any[] = node.arguments
			const line: number = node.loc!.start.line
			const col: number = node.loc!.start.column + 1
			const sourceProp = `__source: { file: ${JSON.stringify(absFile)}, line: ${line}, col: ${col} }`

			if (argIndex < args.length) {
				const arg = args[argIndex]
				if (arg.type !== 'ObjectExpression') return
				const insertPos: number = arg.end! - 1
				const textBeforeClose = code.slice(arg.start!, insertPos).trimEnd()
				const sep =
					arg.properties.length === 0
						? ''
						: textBeforeClose.endsWith(',')
							? ' '
							: ', '
				ms.appendLeft(insertPos, `${sep}${sourceProp}`)
			} else if (argIndex === args.length) {
				ms.appendLeft(
					node.end! - 1,
					`${args.length > 0 ? ', ' : ''}{ ${sourceProp} }`,
				)
			}
		})
	}

	// ── Pass 2a: embed __keyLines into createI18nPlugin result ──────────────────
	// Wraps the createI18nPlugin({…}) call so that the returned plugin object
	// carries __keyLines = { KEY: { file, line } } for every top-level message key.
	// This allows label functions in OTHER files to look up source locations at
	// runtime without needing the key map statically available at transform time.

	if (i18nPluginLocalName) {
		walkAst(ast.program, (node) => {
			if (node.type !== 'CallExpression') return
			if (node.callee.type !== 'Identifier') return
			if (node.callee.name !== i18nPluginLocalName) return

			const arg = node.arguments[0]
			if (!arg || arg.type !== 'ObjectExpression') return

			const messagesProp = arg.properties.find(
				(p: any) =>
					p.type === 'ObjectProperty' &&
					(p.key.name === 'messages' || p.key.value === 'messages'),
			)
			if (!messagesProp || messagesProp.value?.type !== 'ObjectExpression')
				return

			const firstLocale = messagesProp.value.properties[0]
			if (!firstLocale || firstLocale.value?.type !== 'ObjectExpression') return

			const keyLines: Record<string, { file: string; line: number }> = {}
			function collectKeyLines(properties: any[], prefix: string) {
				for (const prop of properties) {
					if (prop.type !== 'ObjectProperty') continue
					const k =
						prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
					if (!k || !prop.loc) continue
					const path = prefix ? `${prefix}.${k}` : k
					if (prop.value?.type === 'ObjectExpression') {
						collectKeyLines(prop.value.properties, path)
					} else {
						keyLines[path] = { file: absFile, line: prop.loc.start.line }
					}
				}
			}
			collectKeyLines(firstLocale.value.properties, '')

			const keyLinesJson = JSON.stringify(keyLines)
			ms.appendLeft(node.start!, 'Object.assign(')
			ms.appendLeft(node.end!, `, { __keyLines: ${keyLinesJson} })`)
		})
	}

	// ── Pass 2b: wrap text getter functions ──────────────────────────────────────
	// Always injects __textSource (declaration line in this file) on any text/label/header arrow fn.
	// Additionally injects __i18nSource for functions matching PLUGIN.t.value[.NS]*.KEY.

	// Traverse PLUGIN.t.value[.NS]*.KEY → { pluginRef, keyPath } or null.
	function extractI18nRef(
		expr: any,
	): { pluginRef: string; keyPath: string } | null {
		const parts: string[] = []
		let cur = expr
		while (cur.type === 'MemberExpression' && !cur.computed) {
			if (cur.property.type !== 'Identifier') return null
			parts.unshift(cur.property.name)
			cur = cur.object
		}
		if (cur.type !== 'Identifier') return null
		if (parts.length < 3 || parts[0] !== 't' || parts[1] !== 'value')
			return null
		return { pluginRef: cur.name, keyPath: parts.slice(2).join('.') }
	}

	const TRACKED_TEXT_PROPS = new Set(['label', 'header', 'text'])

	walkAst(ast.program, (node) => {
		if (node.type !== 'ObjectProperty') return
		const propKey =
			node.key.type === 'Identifier' ? node.key.name : node.key.value
		if (!TRACKED_TEXT_PROPS.has(propKey)) return

		let fn = node.value
		// handle text: text(() => ...) — unwrap the call wrapper
		if (
			fn.type === 'CallExpression' &&
			fn.callee.type === 'Identifier' &&
			fn.arguments.length >= 1 &&
			fn.arguments[0].type === 'ArrowFunctionExpression'
		) {
			fn = fn.arguments[0]
		}
		if (fn.type !== 'ArrowFunctionExpression') return

		const ref = extractI18nRef(fn.body)
		const textLine = node.loc!.start.line

		const extras: string[] = [
			`__textSource: { file: ${JSON.stringify(absFile)}, line: ${textLine} }`,
		]
		if (ref)
			extras.push(
				`get __i18nSource() { return ${ref.pluginRef}.__keyLines?.['${ref.keyPath}'] }`,
			)

		ms.appendLeft(fn.start!, 'Object.assign(')
		ms.appendLeft(fn.end!, `, { ${extras.join(', ')} })`)
	})

	// ── Pass 3: inject import.meta.env into defineAsync calls ───────────────────
	// defineAsync lives in library code outside Vite's project root, so
	// import.meta.env is not available there. The plugin injects it as the
	// third argument here in app code where Vite env is always present.

	if (defineAsyncLocalName) {
		walkAst(ast.program, (node) => {
			if (node.type !== 'CallExpression') return
			if (node.callee.type !== 'Identifier') return
			if (node.callee.name !== defineAsyncLocalName) return
			if (node.arguments.length !== 2) return

			const lastArg = node.arguments[1]
			const textAfterLastArg = code.slice(lastArg.end!, node.end! - 1)
			const hasTrailingComma = textAfterLastArg.includes(',')
			ms.appendLeft(
				node.end! - 1,
				hasTrailingComma ? 'import.meta.env' : ', import.meta.env',
			)
		})
	}

	if (!ms.hasChanged()) return null
	return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
}

export default sourceLocationPlugin
