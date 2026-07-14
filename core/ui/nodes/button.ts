import type { ReactivityApi } from '../../reactivity'
import {
	type ButtonNode,
	type ButtonOptions,
	createResolveCache,
	normalizeRenderContext,
	resolveContextualFn,
} from './nodeTypes'

export function createButtonNode(
	reactivity: ReactivityApi,
	id: string,
	options: ButtonOptions,
): ButtonNode {
	return {
		id,
		type: 'button',
		resolve: createResolveCache((ctx) => ({
			text: resolveContextualFn(reactivity, options.text, ctx),
			disabled: resolveContextualFn(reactivity, options.disabled ?? false, ctx),
			isVisible: resolveContextualFn(
				reactivity,
				options.isVisible ?? true,
				ctx,
			),
			onClick: () => {
				const fn = options.onClick
				if (fn === undefined) return undefined
				if ((fn as (...args: unknown[]) => unknown).length > 0) {
					const resolvedCtx = normalizeRenderContext(ctx)
					return (
						fn as (args: {
							contexts: Record<string, unknown>
						}) => void | Promise<void>
					)({
						contexts: resolvedCtx.contexts,
					})
				}
				return (fn as () => void | Promise<void>)()
			},
		})),
	}
}
