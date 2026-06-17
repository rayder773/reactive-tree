import { computed as vueComputed } from 'vue'
import type { BuildContext, ComputedNode, NodeOptions, NodeSpec } from '../types'
import { activeChecks, diagnosticsFor, diagnosticsRefs, registerDebugNode } from './utils'

export function computed<T>(
  getter: (self: any) => T,
  options: NodeOptions<T> = {},
): NodeSpec<ComputedNode<T>> {
  return {
    build(context: BuildContext) {
      const checks = activeChecks(options)
      const value = vueComputed(() =>
        context.debug.runWithReader(
          { readerId: context.path, reason: 'computed' },
          () => getter(context.self),
        ),
      )

      const node = {
        kind: 'computed' as const,
        label: options.label,
        metadata: options.metadata,
        checks,
        get value() {
          return value.value
        },
      } as unknown as ComputedNode<T>

      registerDebugNode(context, node, 'computed')

      Object.assign(
        node,
        diagnosticsRefs(() => diagnosticsFor(checks, value.value, context, node)),
      )

      context.registerNode?.(node)

      return node
    },
  }
}
