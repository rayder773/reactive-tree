import { ref, type Ref } from 'vue'
import type { BuildContext, NodeOptions, NodeSpec, StateNode } from '../types'
import { activeChecks, diagnosticsFor, diagnosticsRefs } from './utils'
import { normalizeCheckResult } from '../checks/check'

export function state<T>(
  initialValue: T,
  options: NodeOptions<T> = {},
): NodeSpec<StateNode<T>> {
  return {
    build(context: BuildContext) {
      const value = ref(initialValue) as Ref<T>
      const checks = activeChecks(options)

      const node = {
        kind: 'state' as const,
        label: options.label,
        metadata: options.metadata,
        checks,
        get value() {
          return value.value
        },
        set(nextValue: T) {
          for (const item of checks) {
            if (item.mode !== 'block') {
              continue
            }

            const result = normalizeCheckResult(
              item.run(nextValue, { root: context.root, node, phase: 'set' }),
            )

            if (result.block || result.diagnostic) {
              return false
            }
          }

          value.value = nextValue
          return true
        },
        reset() {
          value.value = initialValue
        },
      } as unknown as StateNode<T>

      Object.assign(
        node,
        diagnosticsRefs(() => diagnosticsFor(checks, value.value, context, node)),
      )

      context.registerNode?.(node)

      return node
    },
  }
}
