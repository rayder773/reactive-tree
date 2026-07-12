import type { ReactivityApi } from '../../reactivity'
import { createNodeFactory } from './createNodeFactory'
import {
	createCommonNodeProps,
	type RepeatChild,
	type RepeatNode,
	type RepeatOptions,
	type UiFactoryOptions,
	type UiNodeFactory,
} from './nodeTypes'

export type RepeatUtility<TItem, TNode> = UiNodeFactory<
	RepeatNode<TItem, TNode>,
	RepeatOptions<TItem, TNode>
>

export function createRepeatUtility(
	reactivity: ReactivityApi,
	options: UiFactoryOptions,
): UiNodeFactory<
	RepeatNode<unknown, unknown>,
	RepeatOptions<unknown, unknown>
> {
	return createNodeFactory(options, (input, nextId) => {
		const items = reactivity.toComputed(input.items)
		const nodesByKey = new Map<string, unknown>()

		return {
			...createCommonNodeProps('repeat', input, reactivity, nextId),
			type: 'repeat',
			items,
			children: reactivity.computed(() => {
				const nextChildren: RepeatChild<unknown, unknown>[] = []

				items.get().forEach((item, index) => {
					const key = input.key(item, index)
					const existingNode = nodesByKey.get(key)
					const node = existingNode ?? input.item(item, index)
					nodesByKey.set(key, node)
					nextChildren.push({ key, item, index, node })
				})

				return nextChildren
			}),
		}
	})
}
