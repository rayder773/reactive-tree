import { describe, expect, it, vi } from 'vitest'
import { PartsExampleEnvironment } from '../examples/part-list/data'
import {
	createPartListModel,
	type PartsListView,
} from '../examples/part-list/renderModel'
import {
	createAppRuntime,
	createButtonUtility,
	createReactivityPlugin,
	createRepeatUtility,
	createTextUtility,
} from '../index'

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

describe('UI node utilities', () => {
	it('creates callable utility instances with node storage', () => {
		const reactivity = createReactivityPlugin()
		const button = createButtonUtility(reactivity, { name: 'Buttons' })
		const node = button({
			text: () => 'Save',
			disabled: () => false,
		})

		expect(button.get(node.id)).toBe(node)
		expect(button.values()).toEqual([node])
		expect(node.text.get()).toBe('Save')
		expect(node.disabled.get()).toBe(false)
	})

	it('creates repeat children from reactive item arrays', () => {
		const reactivity = createReactivityPlugin()
		const repeat = createRepeatUtility(reactivity, { name: 'Repeats' })
		const text = createTextUtility(reactivity, { name: 'Texts' })
		const items = reactivity.ref<readonly { id: string; label: string }[]>([
			{ id: 'one', label: 'One' },
		])
		const node = repeat({
			items,
			key: (item) => (item as { id: string }).id,
			item: (item) =>
				text({
					value: () => (item as { label: string }).label,
				}),
		})

		expect(node.children.get()).toHaveLength(1)

		items.set([
			{ id: 'one', label: 'One' },
			{ id: 'two', label: 'Two' },
		])

		expect(node.children.get()).toHaveLength(2)
		expect(text.values()).toHaveLength(2)
	})
})

describe('part list render model', () => {
	it('creates a list without recursively invalidating repeat children', async () => {
		const reactivity = createReactivityPlugin()
		const environment = new PartsExampleEnvironment({
			plugins: [reactivity],
		})
		const model = createPartListModel(environment, reactivity)

		try {
			model.createPartsList()

			expect(model.listsRepeat.children.get()).toHaveLength(1)

			await new Promise((resolve) => setTimeout(resolve, 150))

			const child = model.listsRepeat.children.get()[0]
			const list = child?.node as PartsListView | undefined

			expect(list?.table.rows.get()).toHaveLength(2)
			expect(model.allLoadedPartsTable.rows.get()).toHaveLength(2)
		} finally {
			model.dispose()
			environment.dispose()
		}
	})
})
