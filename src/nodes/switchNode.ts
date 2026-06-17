import { effectScope, watchEffect, type EffectScope } from 'vue'
import type { AnyNode, BuildContext, NodeSpec } from '../types'

export function switchNode<
  TDiscriminant extends PropertyKey,
  TCases extends Partial<Record<TDiscriminant, () => NodeSpec<AnyNode>>>,
>(
  discriminant: (self: any) => TDiscriminant,
  cases: TCases,
): NodeSpec<ReturnType<NonNullable<TCases[keyof TCases]>> extends NodeSpec<infer TNode, any> ? TNode : AnyNode, true> {
  return {
    build(context: BuildContext) {
      let activeKey: PropertyKey | undefined
      let activeNode: AnyNode | undefined
      let activeScope: EffectScope | undefined

      const unmount = () => {
        activeScope?.stop()
        activeScope = undefined
        activeNode = undefined
        activeKey = undefined
      }

      watchEffect(() => {
        const key = discriminant(context.root)

        if (key === activeKey) {
          return
        }

        unmount()

        const factory = cases[key]

          if (factory) {
          activeKey = key
          activeScope = effectScope()
          activeNode = activeScope.run(() =>
            factory().build({
              ...context,
              registerNode: node => {
                activeNode = node
              },
            }),
          ) as AnyNode
        }
      }, { flush: 'sync' })

      const proxy = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === '__activeNode') {
              return activeNode
            }

            return (activeNode as any)?.[property]
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
      ) as any

      context.registerNode?.(proxy)

      return proxy
    },
  }
}
