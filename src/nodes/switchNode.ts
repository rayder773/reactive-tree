import { type EffectScope, effectScope, watchEffect } from 'vue'
import type { AnyNode, BuildContext, NodeSpec, SectionChildren } from '../types'
import { section } from './section'
import { registerDebugNode } from './utils'

function isNodeSpec(value: unknown): value is NodeSpec<any, any> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'build' in value &&
		typeof (value as any).build === 'function'
	)
}

export function switchNode<
	TDiscriminant extends PropertyKey,
	TCases extends Partial<
		Record<TDiscriminant, () => NodeSpec<AnyNode> | SectionChildren>
	>,
>(
	discriminant: (self: any) => TDiscriminant,
	cases: TCases,
): NodeSpec<AnyNode, true> {
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
				context.debug.setNodeActive(context.path, false)
			}

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

			registerDebugNode(context, proxy, 'switch', false)
			context.registerNode?.(proxy)

			watchEffect(
				() => {
					const key = context.debug.runWithReader(
						{ readerId: context.path, reason: 'switchNode' },
						() => discriminant(context.self),
					)

					if (key === activeKey) {
						return
					}

					unmount()

					const factory = cases[key]

					if (factory) {
						activeKey = key
						activeScope = effectScope()
						const result = factory()
						const spec = isNodeSpec(result)
							? result
							: section(result as SectionChildren)
						activeNode = activeScope.run(() =>
							spec.build({
								...context,
								registerNode: (node) => {
									activeNode = node
								},
							}),
						) as AnyNode
						context.debug.setNodeActive(context.path, true)
					} else {
						context.debug.setNodeActive(context.path, false)
					}
				},
				{ flush: 'sync' },
			)

			return proxy
		},
	}
}
