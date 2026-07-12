import type {
	Accessor,
	ReactiveComputed,
	ReactiveSource,
	ReactivityApi,
} from '../../reactivity'

export type ComputedInput<T> = T | Accessor<T> | ReactiveSource<T>

export interface UiNodeBase {
	readonly id: string
	readonly type: string
	readonly isVisible: ReactiveComputed<boolean>
}

export interface TextNode extends UiNodeBase {
	readonly type: 'text'
	readonly value: ReactiveComputed<string>
}

export interface ButtonNode extends UiNodeBase {
	readonly type: 'button'
	readonly text: ReactiveComputed<string>
	readonly disabled: ReactiveComputed<boolean>
	readonly onClick: () => void | Promise<void>
}

export interface RepeatChild<TItem, TNode> {
	readonly key: string
	readonly item: TItem
	readonly index: number
	readonly node: TNode
}

export interface RepeatNode<TItem, TNode> extends UiNodeBase {
	readonly type: 'repeat'
	readonly items: ReactiveComputed<readonly TItem[]>
	readonly children: ReactiveComputed<readonly RepeatChild<TItem, TNode>[]>
}

export interface TableColumn<TRow> {
	readonly id: string
	readonly header: string
	getValue(row: TRow): unknown
}

export interface TableNode<TRow> extends UiNodeBase {
	readonly type: 'table'
	readonly rows: ReactiveComputed<readonly TRow[]>
	readonly columns: readonly TableColumn<TRow>[]
}

export interface UiNodeFactory<TNode extends UiNodeBase, TOptions> {
	(options: TOptions): TNode
	get(id: string): TNode | undefined
	values(): readonly TNode[]
	delete(id: string): boolean
	clear(): void
}

export interface UiFactoryOptions {
	name: string
}

export interface ButtonOptions {
	id?: string
	text: ComputedInput<string>
	disabled?: ComputedInput<boolean>
	isVisible?: ComputedInput<boolean>
	onClick?: () => void | Promise<void>
}

export interface TextOptions {
	id?: string
	value: ComputedInput<string>
	isVisible?: ComputedInput<boolean>
}

export interface RepeatOptions<TItem, TNode> {
	id?: string
	items: ComputedInput<readonly TItem[]>
	key(item: TItem, index: number): string
	item(item: TItem, index: number): TNode
	isVisible?: ComputedInput<boolean>
}

export interface TableOptions<TRow> {
	id?: string
	rows: ComputedInput<readonly TRow[]>
	columns: readonly TableColumn<TRow>[]
	isVisible?: ComputedInput<boolean>
}

export function createCommonNodeProps(
	type: string,
	options: { id?: string; isVisible?: ComputedInput<boolean> },
	reactivity: ReactivityApi,
	nextId: () => string,
): UiNodeBase {
	return {
		id: options.id ?? nextId(),
		type,
		isVisible: reactivity.toComputed(options.isVisible ?? true),
	}
}
