import { computed as vueComputed } from 'vue'
import type { BuildContext, NodeOptions, NodeSpec, SectionChildren, SectionNode } from '../types'
import { activeChecks, childPath, diagnosticsFor, diagnosticsRefs, nodeDiagnostics, nodeValue, registerDebugNode } from './utils'
import { resolveMaybeWhen } from './when'

export function section<TChildren extends SectionChildren>(
  children: TChildren,
  options: NodeOptions<Record<string, unknown>> = {},
): NodeSpec<SectionNode<TChildren>> {
  return {
    build(context: BuildContext) {
      const checks = activeChecks(options)
      const node = {
        kind: 'section' as const,
        label: options.label,
        metadata: options.metadata,
        checks,
      } as unknown as SectionNode<TChildren>

      const childNodes = {} as Record<string, any>

      registerDebugNode(context, node, 'section')
      context.registerNode?.(node)

      for (const key of Object.keys(children)) {
        Object.defineProperty(node, key, {
          enumerable: true,
          configurable: true,
          get: () => resolveMaybeWhen(childNodes[key]),
        })

        const child = children[key].build({
          ...context,
          path: childPath(context.path, key),
          registerNode: earlyNode => {
            childNodes[key] = earlyNode
          },
        })
        childNodes[key] = child
      }

      const valueRef = vueComputed(() => {
        const result: Record<string, unknown> = {}

        for (const key of Object.keys(children)) {
          const child = resolveMaybeWhen(childNodes[key])

          if (child !== undefined) {
            result[key] = nodeValue(child)
          }
        }

        return result
      })

      Object.defineProperty(node, 'value', {
        enumerable: true,
        configurable: true,
        get: () => valueRef.value,
      })
      Object.assign(
        node,
        diagnosticsRefs(() => [
          ...diagnosticsFor(checks, valueRef.value, context, node),
          ...Object.keys(children).flatMap(key =>
            nodeDiagnostics(resolveMaybeWhen(childNodes[key])),
          ),
        ]),
      )

      return node
    },
  }
}
