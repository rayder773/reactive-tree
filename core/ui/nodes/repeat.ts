import type { ReactivityApi } from '../../reactivity'
import {
	createResolveCache,
	type RepeatNode,
	type RepeatOptions,
	resolveContextualFn,
} from './nodeTypes'

export function createRepeatNode<TItem>(
	reactivity: ReactivityApi,
	id: string,
	options: RepeatOptions<TItem>,
): RepeatNode<TItem> {
	return {
		id,
		type: 'repeat',
		context: options.context,
		resolve: createResolveCache((ctx) => ({
			items: resolveContextualFn(reactivity, options.items, ctx),
			isVisible: resolveContextualFn(
				reactivity,
				options.isVisible ?? true,
				ctx,
			),
		})),
		getKey: options.key,
	}
}
