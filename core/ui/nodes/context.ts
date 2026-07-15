import type { ReactivityApi } from '../../reactivity'
import {
	type ContextFactory,
	type ContextNode,
	EMPTY_RENDER_CONTEXT,
	type RenderContext,
	type RenderContexts,
} from './nodeTypes'

export function createContextNode<TValue, TItem = void>(
	reactivity: ReactivityApi,
	id: string,
	factory: ContextFactory<TValue, TItem>,
): ContextNode<TValue, TItem> {
	return {
		id,
		type: 'context',
		get(contexts: RenderContexts): TValue {
			return contexts[id] as TValue
		},
		resolve(ctx?: RenderContext, item?: TItem) {
			const resolvedCtx = ctx ?? EMPTY_RENDER_CONTEXT

			return {
				value: resolveContextFactory(reactivity, factory, resolvedCtx, item),
			}
		},
	}
}

function resolveContextFactory<TValue, TItem>(
	reactivity: ReactivityApi,
	factory: ContextFactory<TValue, TItem>,
	ctx: RenderContext,
	item: TItem | undefined,
) {
	if (reactivity.isReactiveSource(factory)) {
		return reactivity.toComputed(factory)
	}

	if (typeof factory === 'function') {
		const fn = factory as (...args: unknown[]) => TValue

		if (fn.length > 0) {
			return reactivity.computed(() =>
				fn({ contexts: ctx.contexts, item: item as TItem }),
			)
		}

		return reactivity.computed(fn as () => TValue)
	}

	return reactivity.computed(() => factory)
}
