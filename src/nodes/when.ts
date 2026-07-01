import { effectScope, shallowRef, watchEffect, type EffectScope } from 'vue'
import type { AnyNode, BuildContext, NodeSpec, SectionChildren } from '../types'
import { registerDebugNode } from './utils'
import { section } from './section'

function isNodeSpec(value: unknown): value is NodeSpec<any, any> {
  return typeof value === 'object' && value !== null && 'build' in value && typeof (value as any).build === 'function'
}

export function when<TNode extends AnyNode>(
  condition: (self: any, data?: any) => boolean,
  factory: () => NodeSpec<TNode> | SectionChildren,
): NodeSpec<TNode, true> {
  return {
    build(context: BuildContext) {
      const activeNodeRef = shallowRef<TNode | undefined>(undefined)
      let activeScope: EffectScope | undefined

      const mount = () => {
        activeScope = effectScope()
        const result = factory()
        const spec = isNodeSpec(result) ? result : section(result as SectionChildren)
        activeNodeRef.value = activeScope.run(() =>
          spec.build({
            ...context,
            registerNode: node => {
              activeNodeRef.value = node as TNode
            },
          }),
        ) as TNode
      }

      const unmount = () => {
        activeScope?.stop()
        activeScope = undefined
        activeNodeRef.value = undefined
        context.debug.setNodeActive(context.path, false)
      }

      const proxy = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === '__activeNode') {
              return activeNodeRef.value
            }

            return activeNodeRef.value?.[property as keyof TNode]
          },
          has(_target, property) {
            return activeNodeRef.value ? property in activeNodeRef.value : false
          },
          ownKeys() {
            return activeNodeRef.value ? Reflect.ownKeys(activeNodeRef.value) : []
          },
          getOwnPropertyDescriptor(_target, property) {
            if (!activeNodeRef.value) {
              return undefined
            }

            return Object.getOwnPropertyDescriptor(activeNodeRef.value, property)
          },
        },
      ) as TNode

      registerDebugNode(context, proxy as AnyNode, 'when', false)
      context.registerNode?.(proxy)

      watchEffect(() => {
        const enabled = context.debug.runWithReader(
          { readerId: context.path, reason: 'when' },
          () => condition(context.self, context.data),
        )

        if (enabled) {
          if (!activeNodeRef.value) {
            mount()
          }
          context.debug.setNodeActive(context.path, true)
        }
        else if (activeNodeRef.value) {
          unmount()
        }
        else {
          context.debug.setNodeActive(context.path, false)
        }
      }, { flush: 'sync' })

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
