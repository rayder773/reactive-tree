import { describe, expect, it } from 'vitest'
import { createAppRuntime } from '../index'

interface PartFilters extends Record<string, unknown> {
	manufacturer?: string
	minPrice?: number
	inStock?: boolean
}

describe('FiltersService', () => {
	it('creates independent initial objects for each key', () => {
		const filters = createAppRuntime().createFiltersService<PartFilters>({
			initial: () => ({}),
		})

		filters.patch({ manufacturer: 'Contoso' }, 'main')

		expect(filters.get()).toEqual({})
		expect(filters.get('main')).toEqual({ manufacturer: 'Contoso' })
		expect(filters.get('search')).toEqual({})
	})

	it('sets, patches, resets, deletes, and clears filters', () => {
		const filters = createAppRuntime().createFiltersService<PartFilters>({
			initial: { inStock: true },
		})

		filters.set({ manufacturer: 'Contoso', minPrice: 100 }, 'main')
		filters.patch({ minPrice: 200 }, 'main')

		expect(filters.get('main')).toEqual({
			manufacturer: 'Contoso',
			minPrice: 200,
		})

		filters.reset('main')
		expect(filters.get('main')).toEqual({ inStock: true })

		filters.set({ manufacturer: 'Northwind' }, 'main')
		filters.delete('main')
		expect(filters.get('main')).toEqual({ inStock: true })

		filters.set({ manufacturer: 'Northwind' }, 'main')
		filters.clear()
		expect(filters.get('main')).toEqual({ inStock: true })
	})

	it('normalizes composite keys', () => {
		const filters = createAppRuntime().createFiltersService<PartFilters>({
			initial: () => ({}),
		})

		filters.set({ manufacturer: 'Northwind' }, ['parts', 'main'])

		expect(filters.get(['main', 'parts'])).toEqual({
			manufacturer: 'Northwind',
		})
	})

	it('does not expose internal state through get result mutation', () => {
		const filters = createAppRuntime().createFiltersService<PartFilters>({
			initial: () => ({}),
		})

		const value = filters.get('main')
		value.manufacturer = 'Contoso'

		expect(filters.get('main')).toEqual({})
	})
})
