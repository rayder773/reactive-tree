import { computed as vueComputed } from 'vue'
import type { BuildContext, ComputedNode, NodeOptions, NodeSpec } from '../types'
import { activeChecks, diagnosticsFor, diagnosticsRefs } from './utils'

export function computed<T>(
  getter: (self: any) => T,
  options: NodeOptions<T> = {},
): NodeSpec<ComputedNode<T>> {
  return {
    build(context: BuildContext) {
      const checks = activeChecks(options)
      const value = vueComputed(() => getter(context.root))

      const node = {
        kind: 'computed' as const,
        label: options.label,
        metadata: options.metadata,
        get value() {
          return value.value
        },
      } as ComputedNode<T>

      Object.assign(
        node,
        diagnosticsRefs(() => diagnosticsFor(checks, value.value, context, node)),
      )

      context.registerNode?.(node)

      return node
    },
  }
}
