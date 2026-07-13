import type { ReactiveComputed, ReactiveSource, ReactivityApi } from '../../reactivity'

export type ContextualFn<T, TCtx> =
  | T
  | (() => T)
  | ((ctx: TCtx) => T)
  | ReactiveSource<T>

export interface UiNodeBase {
  readonly id: string
  readonly type: string
}

export interface TableColumn<TRow> {
  readonly id: string
  readonly header: string
  getValue(row: TRow): unknown
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
  readonly isVisible: ReactiveComputed<boolean>
}

// Node interfaces

export interface TextNode extends UiNodeBase {
  readonly type: 'text'
  resolve(ctx?: unknown): ResolvedTextNode
}

export interface ButtonNode extends UiNodeBase {
  readonly type: 'button'
  resolve(ctx?: unknown): ResolvedButtonNode
}

export interface TableNode<TRow> extends UiNodeBase {
  readonly type: 'table'
  readonly columns: readonly TableColumn<TRow>[]
  resolve(ctx?: unknown): ResolvedTableNode<TRow>
}

export interface RepeatNode<TItem> extends UiNodeBase {
  readonly type: 'repeat'
  readonly items: ReactiveComputed<readonly TItem[]>
  readonly isVisible: ReactiveComputed<boolean>
  getKey(item: TItem): string
}

// Options interfaces

export interface TextOptions<TCtx = unknown> {
  value: ContextualFn<string, TCtx>
  isVisible?: ContextualFn<boolean, TCtx>
}

export interface ButtonOptions<TCtx = unknown> {
  text: ContextualFn<string, TCtx>
  disabled?: ContextualFn<boolean, TCtx>
  isVisible?: ContextualFn<boolean, TCtx>
  onClick?: (() => void | Promise<void>) | ((ctx: TCtx) => void | Promise<void>)
}

export interface TableOptions<TRow, TCtx = unknown> {
  rows: ContextualFn<readonly TRow[], TCtx>
  columns: readonly TableColumn<TRow>[]
  isVisible?: ContextualFn<boolean, TCtx>
}

export interface RepeatOptions<TItem> {
  items: ContextualFn<readonly TItem[], unknown>
  key(item: TItem): string
  isVisible?: ContextualFn<boolean, unknown>
}

// Helpers

const UI_NO_CTX = Symbol('ui-no-ctx')

export function resolveContextualFn<T>(
  reactivity: ReactivityApi,
  input: ContextualFn<T, unknown>,
  ctx: unknown,
): ReactiveComputed<T> {
  if (reactivity.isReactiveSource(input)) {
    return reactivity.toComputed(input as ReactiveSource<T>)
  }
  if (typeof input === 'function') {
    const fn = input as (...args: unknown[]) => T
    if (fn.length > 0) {
      return reactivity.computed(() => fn(ctx))
    }
    return reactivity.computed(fn as () => T)
  }
  return reactivity.computed(() => input as T)
}

export function createResolveCache<TResolved>(
  factory: (ctx: unknown) => TResolved,
): (ctx?: unknown) => TResolved {
  const cache = new Map<unknown, TResolved>()
  return (ctx?: unknown): TResolved => {
    const key = ctx ?? UI_NO_CTX
    const existing = cache.get(key)
    if (existing !== undefined) return existing
    const resolved = factory(ctx)
    cache.set(key, resolved)
    return resolved
  }
}
