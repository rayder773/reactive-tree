import { describe, expect, it } from 'vitest'
import { createAppRuntime } from '../index'

type Field = 'name' | 'price' | 'manufacturer'

describe('SortingService', () => {
	it('creates independent initial state for default and keyed values', () => {
		const sorting = createAppRuntime().createSortingService<Field>({
			initial: { field: 'name', direction: 'asc' },
		})

		expect(sorting.get()).toEqual({ field: 'name', direction: 'asc' })
		expect(sorting.get('main')).toEqual({ field: 'name', direction: 'asc' })

		sorting.set({ field: 'price', direction: 'desc' }, 'main')

		expect(sorting.get()).toEqual({ field: 'name', direction: 'asc' })
		expect(sorting.get('main')).toEqual({ field: 'price', direction: 'desc' })
	})

	it('normalizes composite keys', () => {
		const sorting = createAppRuntime().createSortingService<Field>({
			initial: { field: 'name', direction: 'asc' },
		})

		sorting.set({ field: 'manufacturer', direction: 'desc' }, ['parts', 'main'])

		expect(sorting.get(['main', 'parts'])).toEqual({
			field: 'manufacturer',
			direction: 'desc',
		})
	})

	it('updates, resets, deletes, and clears state', () => {
		const sorting = createAppRuntime().createSortingService<Field>({
			initial: () => ({ field: 'name', direction: 'asc' }),
		})

		sorting.setField('price', 'main')
		sorting.setDirection('desc', 'main')
		expect(sorting.get('main')).toEqual({ field: 'price', direction: 'desc' })

		sorting.reset('main')
		expect(sorting.get('main')).toEqual({ field: 'name', direction: 'asc' })

		sorting.setField('manufacturer', 'main')
		sorting.delete('main')
		expect(sorting.get('main')).toEqual({ field: 'name', direction: 'asc' })

		sorting.setField('price', 'main')
		sorting.clear()
		expect(sorting.get('main')).toEqual({ field: 'name', direction: 'asc' })
	})

	it('does not expose the stored object by reference', () => {
		const sorting = createAppRuntime().createSortingService<Field>({
			initial: { field: 'name', direction: 'asc' },
		})
		const state = sorting.get('main')

		state.field = 'price'

		expect(sorting.get('main')).toEqual({ field: 'name', direction: 'asc' })
	})
})
