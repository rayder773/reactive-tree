import { computed as vueComputed, effectScope, watchEffect, type EffectScope } from 'vue'
import type { AnyNode, BuildContext, NodeSpec } from '../types'

export function when<TNode extends AnyNode>(
  condition: (self: any) => boolean,
  factory: () => NodeSpec<TNode>,
): NodeSpec<TNode, true> {
  return {
    build(context: BuildContext) {
      let activeNode: TNode | undefined
      let activeScope: EffectScope | undefined

      const mount = () => {
        activeScope = effectScope()
        activeNode = activeScope.run(() =>
          factory().build({
            ...context,
            registerNode: node => {
              activeNode = node as TNode
            },
          }),
        ) as TNode
      }

      const unmount = () => {
        activeScope?.stop()
        activeScope = undefined
        activeNode = undefined
      }

      watchEffect(() => {
        if (condition(context.root)) {
          if (!activeNode) {
            mount()
          }
        } else if (activeNode) {
          unmount()
        }
      }, { flush: 'sync' })

      const proxy = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === '__activeNode') {
              return activeNode
            }

            return activeNode?.[property as keyof TNode]
          },
          has(_target, property) {
            return activeNode ? property in activeNode : false
          },
          ownKeys() {
            return activeNode ? Reflect.ownKeys(activeNode) : []
          },
          getOwnPropertyDescriptor(_target, property) {
            if (!activeNode) {
              return undefined
            }

            return Object.getOwnPropertyDescriptor(activeNode, property)
          },
        },
      ) as TNode

      context.registerNode?.(proxy)

      return proxy
    },
  }
}

export function resolveMaybeWhen<T>(node: T): T | undefined {
  const maybeActive = (node as any)?.__activeNode
  return maybeActive === undefined && (node as any)?.kind === undefined
    ? undefined
    : ((node as any)?.__activeNode ?? node)
}
