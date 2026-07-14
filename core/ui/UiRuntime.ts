import type { ReactivityApi } from '../reactivity'
import { createButtonNode } from './nodes/button'
import { createContextNode } from './nodes/context'
import type {
	ButtonNode,
	ButtonOptions,
	ContextFactory,
	ContextNode,
	RepeatNode,
	RepeatOptions,
	TableNode,
	TableOptions,
	TextNode,
	TextOptions,
} from './nodes/nodeTypes'
import { createRepeatNode } from './nodes/repeat'
import { createTableNode } from './nodes/table'
import { createTextNode } from './nodes/text'
import { createReactiveList, type ReactiveList } from './reactive-list'

export interface UiRuntime {
	context<TValue, TItem = void>(
		id: string,
		factory: ContextFactory<TValue, TItem>,
	): ContextNode<TValue, TItem>
	context<TValue = unknown, TItem = unknown>(
		id: string,
	): ContextNode<TValue, TItem>
	text(id: string, options: TextOptions): TextNode
	text(id: string): TextNode
	button(id: string, options: ButtonOptions): ButtonNode
	button(id: string): ButtonNode
	table<TRow>(id: string, options: TableOptions<TRow>): TableNode<TRow>
	table<TRow>(id: string): TableNode<TRow>
	repeat<TItem>(id: string, options: RepeatOptions<TItem>): RepeatNode<TItem>
	repeat<TItem>(id: string): RepeatNode<TItem>
	createList<T>(): ReactiveList<T>
}

export function createUiRuntime(reactivity: ReactivityApi): UiRuntime {
	const texts = new Map<string, TextNode>()
	const buttons = new Map<string, ButtonNode>()
	const contexts = new Map<string, ContextNode<unknown, unknown>>()
	const tables = new Map<string, TableNode<unknown>>()
	const repeats = new Map<string, RepeatNode<unknown>>()

	function getOrThrow<T>(map: Map<string, T>, type: string, id: string): T {
		const node = map.get(id)
		if (node === undefined) {
			throw new Error(`UiRuntime: ${type} node "${id}" not found`)
		}
		return node
	}

	return {
		context<TValue, TItem = void>(
			id: string,
			factory?: ContextFactory<TValue, TItem>,
		): ContextNode<TValue, TItem> {
			if (factory !== undefined) {
				const node = createContextNode(reactivity, id, factory)
				contexts.set(id, node as ContextNode<unknown, unknown>)
				return node
			}
			return getOrThrow(contexts, 'context', id) as ContextNode<TValue, TItem>
		},

		text(id: string, options?: TextOptions): TextNode {
			if (options !== undefined) {
				const node = createTextNode(reactivity, id, options)
				texts.set(id, node)
				return node
			}
			return getOrThrow(texts, 'text', id)
		},

		button(id: string, options?: ButtonOptions): ButtonNode {
			if (options !== undefined) {
				const node = createButtonNode(reactivity, id, options)
				buttons.set(id, node)
				return node
			}
			return getOrThrow(buttons, 'button', id)
		},

		table<TRow>(id: string, options?: TableOptions<TRow>): TableNode<TRow> {
			if (options !== undefined) {
				const node = createTableNode(reactivity, id, options)
				tables.set(id, node as TableNode<unknown>)
				return node
			}
			return getOrThrow(tables, 'table', id) as TableNode<TRow>
		},

		repeat<TItem>(
			id: string,
			options?: RepeatOptions<TItem>,
		): RepeatNode<TItem> {
			if (options !== undefined) {
				const node = createRepeatNode(reactivity, id, options)
				repeats.set(id, node as RepeatNode<unknown>)
				return node
			}
			return getOrThrow(repeats, 'repeat', id) as RepeatNode<TItem>
		},

		createList<T>(): ReactiveList<T> {
			return createReactiveList<T>(reactivity)
		},
	}
}
