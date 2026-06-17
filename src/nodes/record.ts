import { computed as vueComputed, effectScope, shallowReactive, watchEffect, type EffectScope } from 'vue'
import type { AnyNode, BuildContext, NodeOptions, NodeSpec, RecordNode } from '../types'
import { activeChecks, diagnosticsFor, diagnosticsRefs, nodeDiagnostics, nodeValue } from './utils'
import { resolveMaybeWhen } from './when'

export interface RecordOptions<TItem, TKey extends string, TItemNode extends AnyNode> extends NodeOptions<Record<string, TItemNode['value']>> {
  from: (self: any) => readonly TItem[]
  key: (item: TItem) => TKey
  item: (item: TItem) => NodeSpec<TItemNode>
}

export function record<
  TItem = any,
  TKey extends string = string,
  TItemNode extends AnyNode = AnyNode,
>(
  options: RecordOptions<TItem, TKey, TItemNode>,
): NodeSpec<RecordNode<TItemNode, TKey>> {
  return {
    build(context: BuildContext) {
      const checks = activeChecks(options)
      const entries = shallowReactive(new Map<string, { node: TItemNode; scope: EffectScope }>()) as Map<
        string,
        { node: TItemNode; scope: EffectScope }
      >

      const node = {
        kind: 'record' as const,
        label: options.label,
        metadata: options.metadata,
        byKey(key: string) {
          return resolveMaybeWhen(entries.get(key)?.node) as TItemNode | undefined
        },
      } as RecordNode<TItemNode, TKey>

      const ensureProperty = (key: string) => {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          return
        }

        Object.defineProperty(node, key, {
          enumerable: true,
          configurable: true,
          get: () => node.byKey(key),
        })
      }

      watchEffect(() => {
        const source = options.from(context.root)
        const nextKeys = new Set<string>()

        for (const sourceItem of source) {
          const key = options.key(sourceItem)
          nextKeys.add(key)
          ensureProperty(key)

          if (!entries.has(key)) {
            const scope = effectScope()
            const itemNode = scope.run(() =>
              options.item(sourceItem).build({ ...context, registerNode: undefined }),
            ) as TItemNode
            entries.set(key, { node: itemNode, scope })
          }
        }

        for (const [key, entry] of Array.from(entries)) {
          if (!nextKeys.has(key)) {
            entry.scope.stop()
            entries.delete(key)
            delete (node as any)[key]
          }
        }
      }, { flush: 'sync' })

      const items = vueComputed(() => {
        const result: Record<string, TItemNode> = {}

        for (const [key, entry] of entries) {
          const item = resolveMaybeWhen(entry.node)

          if (item) {
            result[key] = item as TItemNode
          }
        }

        return result
      })

      const valueRef = vueComputed(() => {
        const result: Record<string, TItemNode['value']> = {}

        for (const [key, item] of Object.entries(items.value)) {
          result[key] = nodeValue(item) as TItemNode['value']
        }

        return result
      })

      Object.assign(node, { items })
      Object.defineProperty(node, 'value', {
        enumerable: true,
        configurable: true,
        get: () => valueRef.value,
      })
      Object.assign(
        node,
        diagnosticsRefs(() => [
          ...diagnosticsFor(checks, valueRef.value, context, node),
          ...Object.values(items.value).flatMap(item => nodeDiagnostics(item)),
        ]),
      )

      context.registerNode?.(node)

      return node
    },
  }
}
