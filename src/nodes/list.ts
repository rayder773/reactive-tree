import {
	type EffectScope,
	effectScope,
	shallowReactive,
	computed as vueComputed,
	watchEffect,
} from 'vue'
import type {
	AnyNode,
	BuildContext,
	ListNode,
	NodeOptions,
	NodeSpec,
	SectionChildren,
} from '../types'
import { section } from './section'
import {
	activeChecks,
	childPath,
	diagnosticsFor,
	diagnosticsRefs,
	nodeDiagnostics,
	nodeValue,
	registerDebugNode,
} from './utils'
import { resolveMaybeWhen } from './when'

function isNodeSpec(value: unknown): value is NodeSpec<any, any> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'build' in value &&
		typeof (value as any).build === 'function'
	)
}

export interface ListOptions<
	TItem,
	TKey extends PropertyKey,
	TItemNode extends AnyNode,
> extends NodeOptions<NodeValueArray<TItemNode>> {
	from: (self: any, data?: any) => readonly TItem[]
	key: (item: TItem) => TKey
	item: (item: TItem) => NodeSpec<TItemNode> | SectionChildren
}

type NodeValueArray<TNode extends AnyNode> = Array<TNode['value']>

export function list<
	TItem = any,
	TKey extends PropertyKey = PropertyKey,
	TItemNode extends AnyNode = AnyNode,
>(options: ListOptions<TItem, TKey, TItemNode>): NodeSpec<ListNode<TItemNode>> {
	return {
		build(context: BuildContext) {
			const checks = activeChecks(options)
			const entries = shallowReactive(
				new Map<PropertyKey, { node: TItemNode; scope: EffectScope }>(),
			) as Map<PropertyKey, { node: TItemNode; scope: EffectScope }>

			const node = {
				kind: 'list' as const,
				id: options.id,
				label: options.label,
				metadata: options.metadata,
				checks,
				byKey(key: PropertyKey) {
					return resolveMaybeWhen(entries.get(key)?.node) as
						| TItemNode
						| undefined
				},
			} as unknown as ListNode<TItemNode>

			registerDebugNode(context, node, 'list')

			watchEffect(
				() => {
					const source = context.debug.runWithReader(
						{ readerId: context.path, reason: 'list.from' },
						() => options.from(context.self, context.data),
					)
					const nextKeys = new Set<PropertyKey>()

					for (const sourceItem of source) {
						const key = options.key(sourceItem)
						nextKeys.add(key)

						if (!entries.has(key)) {
							const scope = effectScope()
							const result = options.item(sourceItem)
							const spec = isNodeSpec(result)
								? result
								: section(result as SectionChildren)
							const itemNode = scope.run(() =>
								spec.build({
									...context,
									path: childPath(context.path, String(key)),
									registerNode: undefined,
								}),
							) as TItemNode
							entries.set(key, { node: itemNode, scope })
						}
					}

					for (const [key, entry] of Array.from(entries)) {
						if (!nextKeys.has(key)) {
							entry.scope.stop()
							entries.delete(key)
						}
					}
				},
				{ flush: 'sync' },
			)

			const items = vueComputed(
				() =>
					Array.from(entries.values())
						.map((entry) => resolveMaybeWhen(entry.node))
						.filter(Boolean) as TItemNode[],
			)
			const valueRef = vueComputed(
				() =>
					items.value.map((item) =>
						nodeValue(item),
					) as NodeValueArray<TItemNode>,
			)

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
					...items.value.flatMap((item) => nodeDiagnostics(item)),
				]),
			)

			context.registerNode?.(node)

			return node
		},
	}
}
