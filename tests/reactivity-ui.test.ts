import { describe, expect, it, vi } from 'vitest'
import {
	type ContextNode,
	createChildRenderContext,
	EMPTY_RENDER_CONTEXT,
	type RenderContext,
} from '../core/ui'
import { createUiRuntime } from '../core/ui/UiRuntime'
import { PartsExampleEnvironment } from '../examples/part-list/data'
import { createPartListModel } from '../examples/part-list/renderModel'
import { createAppRuntime, createReactivity } from '../index'

describe('Reactivity', () => {
	it('tracks plain store reads from computed values', () => {
		const reactivity = createReactivity()
		const app = createAppRuntime({ plugins: [reactivity] })
		const store = app.createStore<number>({ name: 'CounterStore' })
		const value = reactivity.computed(() => store.get('count') ?? 0)
		const subscriber = vi.fn()

		value.subscribe(subscriber)
		expect(value.get()).toBe(0)

		store.set(2, 'count')

		expect(subscriber).toHaveBeenCalledTimes(1)
		expect(value.dirty).toBe(true)
		expect(value.get()).toBe(2)
	})

	it('keeps store-key invalidation scoped', () => {
		const reactivity = createReactivity()
		const app = createAppRuntime({ plugins: [reactivity] })
		const store = app.createStore<number>({ name: 'CounterStore' })
		const value = reactivity.computed(() => store.get('first') ?? 0)
		const subscriber = vi.fn()

		value.subscribe(subscriber)
		expect(value.get()).toBe(0)

		store.set(2, 'second')

		expect(subscriber).not.toHaveBeenCalled()
		expect(value.dirty).toBe(false)
	})

	it('tracks refs used by computed values', () => {
		const reactivity = createReactivity()
		const source = reactivity.ref(1)
		const doubled = reactivity.computed(() => source.get() * 2)

		expect(doubled.get()).toBe(2)

		source.set(3)

		expect(doubled.get()).toBe(6)
	})
})

describe('UiRuntime nodes', () => {
	it('creates and retrieves button node with resolve()', () => {
		const reactivity = createReactivity()
		const ui = createUiRuntime({ reactivity })
		const onClick = vi.fn()

		const node = ui.button('save', {
			text: () => 'Save',
			disabled: () => false,
			onClick,
		})

		const resolved = node.resolve()
		expect(resolved.text.get()).toBe('Save')
		expect(resolved.disabled.get()).toBe(false)

		resolved.onClick()
		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it('resolves parametrized node with context', () => {
		const reactivity = createReactivity()
		const ui = createUiRuntime({ reactivity })
		const itemContext = ui.context<{ label: string }, string>(
			'item',
			({ item }) => ({ label: `Label for ${item}` }),
		)

		ui.text('item:label', {
			value: ({ contexts }) => (contexts.item as { label: string }).label,
		})

		const node = ui.text('item:label')
		expect(node.resolve(resolveContext(itemContext, 'abc')).value.get()).toBe(
			'Label for abc',
		)
		expect(node.resolve(resolveContext(itemContext, 'xyz')).value.get()).toBe(
			'Label for xyz',
		)
	})

	it('caches resolved instances per context', () => {
		const reactivity = createReactivity()
		const ui = createUiRuntime({ reactivity })
		const valueContext = ui.context<string, string>('value', ({ item }) => item)

		const node = ui.text('cached', {
			value: ({ contexts }) => contexts.value as string,
		})
		const ctxA = resolveContext(valueContext, 'key-a')
		const ctxB = resolveContext(valueContext, 'key-b')
		const a1 = node.resolve(ctxA)
		const a2 = node.resolve(ctxA)
		const b1 = node.resolve(ctxB)

		expect(a1).toBe(a2)
		expect(a1).not.toBe(b1)
	})

	it('creates reactive list that triggers computed re-evaluation', () => {
		const reactivity = createReactivity()
		const ui = createUiRuntime({ reactivity })
		const list = ui.createList<string>()

		const node = ui.repeat('items', {
			items: () => list.get(),
			key: (k) => k,
		})

		expect(node.resolve().items.get()).toHaveLength(0)

		list.append(['a', 'b'])

		expect(node.resolve().items.get()).toHaveLength(2)
	})

	it('rejects duplicate context names in one render branch', () => {
		const reactivity = createReactivity()
		const ui = createUiRuntime({ reactivity })
		const first = ui.context('same', () => ({ value: 1 }))
		const second = ui.context('same', () => ({ value: 2 }))
		const ctx = resolveContext(first)

		expect(() => resolveContext(second, undefined, ctx)).toThrow(
			'context "same" is already provided',
		)
	})
})

describe('part list render model', () => {
	it('adds a list key and loads parts after button click', async () => {
		const environment = new PartsExampleEnvironment()
		const model = createPartListModel(environment)

		try {
			const rootContext = resolveContext(model.partsContext)
			const lists = model.listsRepeat.resolve(rootContext)

			expect(lists.items.get()).toHaveLength(0)

			model.createListButton.resolve(rootContext).onClick()

			expect(lists.items.get()).toHaveLength(1)

			const key = lists.items.get()[0]
			const partListContextNode = model.listsRepeat.context

			if (key === undefined) {
				throw new Error('Expected created list key')
			}

			if (partListContextNode === undefined) {
				throw new Error('Expected part list item context')
			}

			const partListContext = resolveContext(
				partListContextNode,
				key,
				rootContext,
			)

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(
				model.partListTable.resolve(partListContext).rows.get(),
			).toHaveLength(2)
			expect(
				model.allLoadedPartsTable.resolve(rootContext).rows.get(),
			).toHaveLength(2)
		} finally {
			model.dispose()
			environment.dispose()
		}
	})
})

function resolveContext<TValue, TItem>(
	node: ContextNode<TValue, TItem>,
	item?: TItem,
	parent: RenderContext = EMPTY_RENDER_CONTEXT,
): RenderContext {
	const resolved = node.resolve(parent, item)
	return createChildRenderContext(parent, node.id, resolved.value)
}
