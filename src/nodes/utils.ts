import { computed as vueComputed } from 'vue'
import type { AnyNode, BuildContext, Check, Diagnostic, NodeOptions } from '../types'
import { normalizeCheckResult } from '../checks/check'

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
      item.run(value, { root: context.root, node, phase: 'validate' }),
    )
    const resultDiagnostics = result.diagnostic

    if (!resultDiagnostics) {
      continue
    }

    const list = Array.isArray(resultDiagnostics)
      ? resultDiagnostics
      : [resultDiagnostics]

    diagnostics.push(
      ...list.map(diagnostic =>
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
    diagnostics.value.filter(diagnostic => diagnostic.level === 'error'),
  )
  const warnings = vueComputed(() =>
    diagnostics.value.filter(diagnostic => diagnostic.level === 'warning'),
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
