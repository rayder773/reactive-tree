import { describe, expect, it, vi } from 'vitest'
import { PartsExampleEnvironment } from '../examples/part-list/data'
import { createPartListModel } from '../examples/part-list/renderModel'
import { createAppRuntime, createReactivityPlugin } from '../index'
import { createUiRuntime } from '../core/ui/UiRuntime'

describe('ReactivityPlugin', () => {
	it('tracks plain store reads from computed values', () => {
		const reactivity = createReactivityPlugin()
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
		const reactivity = createReactivityPlugin()
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
		const reactivity = createReactivityPlugin()
		const source = reactivity.ref(1)
		const doubled = reactivity.computed(() => source.get() * 2)

		expect(doubled.get()).toBe(2)

		source.set(3)

		expect(doubled.get()).toBe(6)
	})
})

describe('UiRuntime nodes', () => {
	it('creates and retrieves button node with resolve()', () => {
		const reactivity = createReactivityPlugin()
		const ui = createUiRuntime(reactivity)
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
		const reactivity = createReactivityPlugin()
		const ui = createUiRuntime(reactivity)

		ui.text('item:label', {
			value: (key: string) => `Label for ${key}`,
		})

		const node = ui.text('item:label')
		expect(node.resolve('abc').value.get()).toBe('Label for abc')
		expect(node.resolve('xyz').value.get()).toBe('Label for xyz')
	})

	it('caches resolved instances per context', () => {
		const reactivity = createReactivityPlugin()
		const ui = createUiRuntime(reactivity)

		const node = ui.text('cached', { value: (k: string) => k })
		const a1 = node.resolve('key-a')
		const a2 = node.resolve('key-a')
		const b1 = node.resolve('key-b')

		expect(a1).toBe(a2)
		expect(a1).not.toBe(b1)
	})

	it('creates reactive list that triggers computed re-evaluation', () => {
		const reactivity = createReactivityPlugin()
		const ui = createUiRuntime(reactivity)
		const list = ui.createList<string>()

		const node = ui.repeat('items', {
			items: () => list.get(),
			key: (k) => k,
		})

		expect(node.items.get()).toHaveLength(0)

		list.append(['a', 'b'])

		expect(node.items.get()).toHaveLength(2)
	})
})

describe('part list render model', () => {
	it('adds a list key and loads parts after button click', async () => {
		const environment = new PartsExampleEnvironment()
		const model = createPartListModel(environment)

		try {
			expect(model.listsRepeat.items.get()).toHaveLength(0)

			model.createListButton.resolve().onClick()

			expect(model.listsRepeat.items.get()).toHaveLength(1)

			const key = model.listsRepeat.items.get()[0]!

			await new Promise((resolve) => setTimeout(resolve, 150))

			expect(model.partListTable.resolve(key).rows.get()).toHaveLength(2)
			expect(model.allLoadedPartsTable.resolve().rows.get()).toHaveLength(2)
		} finally {
			model.dispose()
			environment.dispose()
		}
	})
})
