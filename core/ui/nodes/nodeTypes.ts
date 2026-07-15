import type {
	ReactiveComputed,
	ReactiveSource,
	ReactivityApi,
} from '../../reactivity'

export type RenderContexts = Record<string, unknown>

export interface RenderCallbackArgs {
	readonly contexts: RenderContexts
}

export interface ContextCallbackArgs<TItem = unknown>
	extends RenderCallbackArgs {
	readonly item: TItem
}

export interface RenderContext {
	readonly contexts: RenderContexts
}

export type ContextualFn<T> =
	| T
	| (() => T)
	| ((args: RenderCallbackArgs) => T)
	| ReactiveSource<T>

export type ContextFactory<TValue, TItem = void> =
	| (() => TValue)
	| ((args: ContextCallbackArgs<TItem>) => TValue)
	| ReactiveSource<TValue>

export interface UiNodeBase {
	readonly id: string
	readonly type: string
}

// Resolved shapes returned by node.resolve(ctx?)

export interface ResolvedTextNode {
	readonly value: ReactiveComputed<string>
	readonly isVisible: ReactiveComputed<boolean>
}

export interface ResolvedButtonNode {
	readonly text: ReactiveComputed<string>
	readonly disabled: ReactiveComputed<boolean>
	readonly isVisible: ReactiveComputed<boolean>
	readonly onClick: () => void | Promise<void>
}

export interface ResolvedTableNode<TRow> {
	readonly rows: ReactiveComputed<readonly TRow[]>
	readonly columns: ReactiveComputed<readonly string[]>
	readonly isVisible: ReactiveComputed<boolean>
}

export interface ResolvedRepeatNode<TItem> {
	readonly items: ReactiveComputed<readonly TItem[]>
	readonly isVisible: ReactiveComputed<boolean>
}

export interface ResolvedContextNode<TValue> {
	readonly value: ReactiveComputed<TValue>
}

// Node interfaces

export interface ContextNode<TValue = unknown, TItem = unknown>
	extends UiNodeBase {
	readonly type: 'context'
	get(contexts: RenderContexts): TValue
	resolve(ctx?: RenderContext, item?: TItem): ResolvedContextNode<TValue>
}

export interface TextNode extends UiNodeBase {
	readonly type: 'text'
	resolve(ctx?: RenderContext): ResolvedTextNode
}

export interface ButtonNode extends UiNodeBase {
	readonly type: 'button'
	resolve(ctx?: RenderContext): ResolvedButtonNode
}

export interface TableNode<TRow> extends UiNodeBase {
	readonly type: 'table'
	readonly rowContext: ContextNode<unknown, TRow> | undefined
	readonly columnContext: ContextNode<unknown, string> | undefined
	readonly getRowKey: (row: unknown, index: number) => string
	resolve(ctx?: RenderContext): ResolvedTableNode<TRow>
}

export interface RepeatNode<TItem> extends UiNodeBase {
	readonly type: 'repeat'
	readonly context?: ContextNode<unknown, TItem>
	resolve(ctx?: RenderContext): ResolvedRepeatNode<TItem>
	getKey(item: TItem): string
}

// Options interfaces

export interface TextOptions {
	value: ContextualFn<string>
	isVisible?: ContextualFn<boolean>
}

export interface ButtonOptions {
	text: ContextualFn<string>
	disabled?: ContextualFn<boolean>
	isVisible?: ContextualFn<boolean>
	onClick?:
		| (() => void | Promise<void>)
		| ((args: RenderCallbackArgs) => void | Promise<void>)
}

export interface TableOptions<TRow> {
	rows: ContextualFn<readonly TRow[]>
	columns: ContextualFn<readonly string[]>
	rowKey?: (row: TRow) => string
	rowContext?: ContextNode<unknown, TRow>
	columnContext?: ContextNode<unknown, string>
	isVisible?: ContextualFn<boolean>
}

export interface RepeatOptions<TItem> {
	items: ContextualFn<readonly TItem[]>
	key(item: TItem): string
	isVisible?: ContextualFn<boolean>
	context?: ContextNode<unknown, TItem>
}

// Helpers

const EMPTY_CONTEXTS = Object.freeze(Object.create(null)) as RenderContexts

export const EMPTY_RENDER_CONTEXT: RenderContext = Object.freeze({
	contexts: EMPTY_CONTEXTS,
})

export function createChildRenderContext<TValue>(
	parent: RenderContext,
	name: string,
	value: ReactiveSource<TValue>,
): RenderContext {
	if (name in parent.contexts) {
		throw new Error(`UiRuntime: context "${name}" is already provided`)
	}

	const contexts = Object.create(parent.contexts) as RenderContexts
	Object.defineProperty(contexts, name, {
		enumerable: true,
		configurable: false,
		get: () => value.get(),
	})

	return Object.freeze({ contexts })
}

export function normalizeRenderContext(ctx?: RenderContext): RenderContext {
	return ctx ?? EMPTY_RENDER_CONTEXT
}

export function resolveContextualFn<T>(
	reactivity: ReactivityApi,
	input: ContextualFn<T>,
	ctx: RenderContext,
): ReactiveComputed<T> {
	if (reactivity.isReactiveSource(input)) {
		return reactivity.toComputed(input as ReactiveSource<T>)
	}
	if (typeof input === 'function') {
		const fn = input as (...args: unknown[]) => T
		if (fn.length > 0) {
			return reactivity.computed(() => fn({ contexts: ctx.contexts }))
		}
		return reactivity.computed(fn as () => T)
	}
	return reactivity.computed(() => input as T)
}

export function createResolveCache<TResolved>(
	factory: (ctx: RenderContext) => TResolved,
): (ctx?: RenderContext) => TResolved {
	const cache = new WeakMap<RenderContext, TResolved>()
	return (ctx?: RenderContext): TResolved => {
		const resolvedCtx = normalizeRenderContext(ctx)
		const existing = cache.get(resolvedCtx)
		if (existing !== undefined) return existing
		const resolved = factory(resolvedCtx)
		cache.set(resolvedCtx, resolved)
		return resolved
	}
}
