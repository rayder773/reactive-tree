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
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra' || key === 'type') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) walkAst(item, visitor)
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
      if (id.endsWith('.ts') || id.endsWith('.tsx')) return transformTs(code, id)
      return null
    },
  }
}

function transformVue(code: string, _id: string): { code: string; map: any } | null {
  const ms = new MagicString(code)

  // Pass 1: inject :data-source-line on elements with v-inspect
  const vInspectRegex = /(<[a-zA-Z][^\n>]*?\bv-inspect\b[^\n>]*?>)/g
  let match: RegExpExecArray | null
  while ((match = vInspectRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length
    ms.appendLeft(match.index + match[0].length - 1, ` :data-source-line="${line}"`)
  }

  // Pass 2: inject :__inspectSourceLine on PascalCase components that have :node prop.
  // [^>\/] + \/(?!>) allows '/' in URLs but stops before '/>' so the closing group captures it.
  const componentTagRegex = /<([A-Z][a-zA-Z0-9]*)((?:[^>\/]|\/(?!>))*)(\/>|>)/g
  while ((match = componentTagRegex.exec(code)) !== null) {
    if (!match[2].includes(':node=')) continue
    const line = code.slice(0, match.index).split('\n').length
    const insertPos = match.index + match[0].length - match[3].length
    ms.appendLeft(insertPos, ` :__inspectSourceLine="${line}"`)
  }

  if (!ms.hasChanged()) return null
  return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
}

function transformTs(code: string, id: string): { code: string; map: any } | null {
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['typescript'], attachComment: false })
  } catch {
    return null
  }

  const localToFactory = new Map<string, string>()
  let i18nPluginLocalName: string | null = null

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue
    if (!isLibraryImport(node.source.value)) continue
    for (const spec of node.specifiers) {
      if (spec.type !== 'ImportSpecifier') continue
      const imported = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value
      if (TRACKED_FACTORIES.has(imported)) localToFactory.set(spec.local.name, imported)
      if (imported === 'createI18nPlugin') i18nPluginLocalName = spec.local.name
    }
  }

  const hasI18nLabelPattern = code.includes('.t.value.')
  if (localToFactory.size === 0 && !i18nPluginLocalName && !hasI18nLabelPattern) return null

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
        const sep = arg.properties.length === 0 ? '' : textBeforeClose.endsWith(',') ? ' ' : ', '
        ms.appendLeft(insertPos, `${sep}${sourceProp}`)
      } else if (argIndex === args.length) {
        ms.appendLeft(node.end! - 1, `${args.length > 0 ? ', ' : ''}{ ${sourceProp} }`)
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
        (p: any) => p.type === 'ObjectProperty' && (p.key.name === 'messages' || p.key.value === 'messages'),
      )
      if (!messagesProp || messagesProp.value?.type !== 'ObjectExpression') return

      const firstLocale = messagesProp.value.properties[0]
      if (!firstLocale || firstLocale.value?.type !== 'ObjectExpression') return

      const keyLines: Record<string, { file: string; line: number }> = {}
      for (const prop of firstLocale.value.properties) {
        if (prop.type !== 'ObjectProperty') continue
        const k = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
        if (k && prop.loc) keyLines[k] = { file: absFile, line: prop.loc.start.line }
      }

      const keyLinesJson = JSON.stringify(keyLines)
      ms.appendLeft(node.start!, 'Object.assign(')
      ms.appendLeft(node.end!, `, { __keyLines: ${keyLinesJson} })`)
    })
  }

  // ── Pass 2b: wrap label functions with dynamic __i18nSource getter ───────────
  // Find: ObjectProperty { label: () => PLUGIN.t.value.KEY }
  // Wrap: Object.assign(() => PLUGIN.t.value.KEY, { get __i18nSource() { return PLUGIN.__keyLines?.['KEY'] } })
  // PLUGIN is extracted from the AST — works regardless of which file defines the plugin.

  if (hasI18nLabelPattern) {
    walkAst(ast.program, (node) => {
      if (node.type !== 'ObjectProperty') return
      const propKey = node.key.type === 'Identifier' ? node.key.name : node.key.value
      if (propKey !== 'label') return

      const fn = node.value
      if (fn.type !== 'ArrowFunctionExpression') return

      // Match expression body of form PLUGIN.t.value.KEY (all non-computed)
      const body = fn.body
      if (body.type !== 'MemberExpression' || body.computed) return
      if (body.object?.type !== 'MemberExpression') return
      if (body.object.property?.type !== 'Identifier') return
      if (body.object.property.name !== 'value') return
      if (body.object.object?.type !== 'MemberExpression') return
      if (body.object.object.property?.type !== 'Identifier') return
      if (body.object.object.property.name !== 't') return
      if (body.object.object.object?.type !== 'Identifier') return
      if (body.property?.type !== 'Identifier') return

      const i18nKey: string = body.property.name
      const pluginRef: string = body.object.object.object.name

      ms.appendLeft(fn.start!, 'Object.assign(')
      ms.appendLeft(fn.end!, `, { get __i18nSource() { return ${pluginRef}.__keyLines?.['${i18nKey}'] } })`)
    })
  }

  if (!ms.hasChanged()) return null
  return { code: ms.toString(), map: ms.generateMap({ hires: true }) }
}

export default sourceLocationPlugin
