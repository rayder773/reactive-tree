import { computed as vueComputed } from 'vue'
import { normalizeCheckResult } from '../checks/check'
import type { SourceLocation } from '../debug'
import type {
	AnyNode,
	BuildContext,
	Check,
	Diagnostic,
	NodeOptions,
} from '../types'

const EMPTY_ARRAY: readonly Diagnostic[] = Object.freeze([])

export const emptyDiagnosticsRefs = Object.freeze({
	diagnostics: Object.freeze({ value: EMPTY_ARRAY }),
	errors: Object.freeze({ value: EMPTY_ARRAY }),
	warnings: Object.freeze({ value: EMPTY_ARRAY }),
	valid: Object.freeze({ value: true }),
	invalid: Object.freeze({ value: false }),
})

export function activeChecks<T>(options?: NodeOptions<T>): Check<T>[] {
	return (options?.checks ?? []).filter(Boolean) as Check<T>[]
}

export function diagnosticsFor<T>(
	checks: Check<T>[],
	value: T,
	context: BuildContext,
	node: AnyNode,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = []

	for (const item of checks) {
		if (item.mode === 'meta') {
			continue
		}

		const result = normalizeCheckResult(
			context.debug.runWithReader(
				{ readerId: node.__debug.id, reason: 'check' },
				() => item.run(value, { root: context.self, node, phase: 'validate' }),
			),
		)
		const resultDiagnostics = result.diagnostic

		if (!resultDiagnostics) {
			continue
		}

		const list = Array.isArray(resultDiagnostics)
			? resultDiagnostics
			: [resultDiagnostics]

		diagnostics.push(
			...list.map((diagnostic) =>
				item.mode === 'warning'
					? { ...diagnostic, level: 'warning' as const }
					: diagnostic,
			),
		)
	}

	return diagnostics
}

export function diagnosticsRefs(allDiagnostics: () => Diagnostic[]) {
	const diagnostics = vueComputed(allDiagnostics)
	const errors = vueComputed(() =>
		diagnostics.value.filter((diagnostic) => diagnostic.level === 'error'),
	)
	const warnings = vueComputed(() =>
		diagnostics.value.filter((diagnostic) => diagnostic.level === 'warning'),
	)
	const valid = vueComputed(() => errors.value.length === 0)
	const invalid = vueComputed(() => !valid.value)

	return { diagnostics, errors, warnings, valid, invalid }
}

export function nodeValue(node: AnyNode | undefined): unknown {
	return node?.value
}

export function nodeDiagnostics(node: AnyNode | undefined): Diagnostic[] {
	return node?.diagnostics.value ?? []
}

export function childPath(parentPath: string, key: string): string {
	return parentPath && parentPath !== 'root' ? `${parentPath}.${key}` : key
}

export function registerDebugNode(
	context: BuildContext,
	node: AnyNode,
	kind: string,
	active = true,
	sourceLocation?: SourceLocation,
) {
	const id = context.path || 'root'

	context.debug.registerNode(node, {
		id,
		path: id,
		kind,
		label: node.label,
		active,
		sourceLocation,
	})
}
