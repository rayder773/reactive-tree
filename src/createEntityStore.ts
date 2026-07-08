import type { AnyNode, BuildContext, NodeSpec, StateNode } from './types'
import { state } from './nodes/state'
import { childPath, emptyDiagnosticsRefs, registerDebugNode } from './nodes/utils'

export interface EntityStoreNode<T> extends AnyNode {
	readonly kind: 'entity-store'
	readonly dict: StateNode<Record<string, T>>
	merge(items: T[], getKey: (item: T) => string): void
}

export function createEntityStore<T>(): NodeSpec<EntityStoreNode<T>> {
	return {
		build(context: BuildContext): EntityStoreNode<T> {
			const dictNode = state<Record<string, T>>({}, { label: 'dict' }).build({
				...context,
				path: childPath(context.path, 'dict'),
				registerNode: undefined,
			})

			const node: any = {
				kind: 'entity-store' as const,
				id: undefined,
				label: undefined,
				metadata: undefined,
				checks: [],
				dict: dictNode,
				get value() {
					return dictNode.value
				},
				merge(items: T[], getKey: (item: T) => string) {
					if (items.length === 0) return
					const current = dictNode.value
					const updates = Object.fromEntries(items.map((item) => [getKey(item), item]))
					dictNode.set({ ...current, ...updates })
				},
			}

			registerDebugNode(context, node, 'entity-store')
			Object.assign(node, emptyDiagnosticsRefs)
			context.registerNode?.(node)

			return node as EntityStoreNode<T>
		},
	}
}
