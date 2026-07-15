import { describe, expect, it } from 'vitest'
import {
	mainListKey,
	PartsExampleEnvironment,
	searchListKey,
} from '../examples/part-list/data'

describe('parts domain example', () => {
	it('uses one entity map with independent keyed list state', async () => {
		const environment = new PartsExampleEnvironment()

		try {
			environment.parts.setPageSize(2, mainListKey)
			environment.parts.setPageSize(2, searchListKey)
			environment.parts.setSorting({ field: 'price', direction: 'desc' }, mainListKey)
			environment.parts.setSorting({ field: 'price', direction: 'desc' }, searchListKey)
			environment.parts.setFilters({ maxPrice: 84 }, searchListKey)

			await environment.parts.loadList(mainListKey)
			await environment.parts.loadList(searchListKey)

			environment.parts.setSorting({ field: 'manufacturer', direction: 'asc' }, searchListKey)
			environment.parts.setFilters({ minPrice: 50 }, mainListKey)

			expect(
				environment.parts
					.values()
					.map((part) => part.id)
					.sort(),
			).toEqual(['p-100', 'p-200', 'p-300'])
			expect(
				environment.parts.values().filter((part) => part.id === 'p-100'),
			).toHaveLength(1)
			expect(environment.parts.list(mainListKey).getIds()).toEqual(['p-200', 'p-100'])
			expect(environment.parts.list(searchListKey).getIds()).toEqual(['p-100', 'p-300'])
			expect(environment.parts.pagination(mainListKey)).toEqual({
				page: 1,
				pageSize: 2,
				total: 5,
			})
			expect(environment.parts.pagination(searchListKey)).toEqual({
				page: 1,
				pageSize: 2,
				total: 4,
			})
			expect(environment.parts.sorting(mainListKey)).toEqual({
				field: 'price',
				direction: 'desc',
			})
			expect(environment.parts.sorting(searchListKey)).toEqual({
				field: 'manufacturer',
				direction: 'asc',
			})
			expect(environment.parts.filters(mainListKey)).toEqual({ minPrice: 50 })
			expect(environment.parts.filters(searchListKey)).toEqual({ maxPrice: 84 })

			environment.parts.update({
				id: 'p-100',
				name: 'Updated board',
				manufacturer: 'Northwind Components',
				price: 85,
			})

			expect(environment.parts.list(mainListKey).get()[1]?.name).toBe('Updated board')
			expect(environment.parts.list(searchListKey).get()[0]?.name).toBe('Updated board')

			environment.parts.list(mainListKey).clear()

			expect(environment.parts.list(mainListKey).getIds()).toEqual([])
			expect(environment.parts.list(searchListKey).getIds()).toEqual(['p-100', 'p-300'])

			environment.parts.delete('p-100')

			expect(environment.parts.list(mainListKey).getIds()).toEqual([])
			expect(environment.parts.list(searchListKey).getIds()).toEqual(['p-300'])
		} finally {
			environment.dispose()
		}
	})

	it('can load the next page into a mapped list', async () => {
		const environment = new PartsExampleEnvironment()

		try {
			environment.parts.setPageSize(1, mainListKey)
			environment.parts.setSorting({ field: 'price', direction: 'desc' }, mainListKey)
			await environment.parts.loadList(mainListKey)
			await environment.parts.loadNextPage(mainListKey)

			expect(environment.parts.list(mainListKey).getIds()).toEqual(['p-200', 'p-100'])
			expect(
				environment.parts
					.values()
					.map((part) => part.id)
					.sort(),
			).toEqual(['p-100', 'p-200'])
		} finally {
			environment.dispose()
		}
	})

	it('replaces a list from its configured source', async () => {
		const environment = new PartsExampleEnvironment()

		try {
			environment.parts.setPageSize(1, mainListKey)
			environment.parts.setSorting({ field: 'price', direction: 'desc' }, mainListKey)
			await environment.parts.loadList(mainListKey)
			await environment.parts.loadNextPage(mainListKey)
			environment.parts.setPageSize(2, mainListKey)
			await environment.parts.loadList(mainListKey)

			expect(environment.parts.list(mainListKey).getIds()).toEqual(['p-200', 'p-100'])
			expect(
				environment.parts
					.values()
					.map((part) => part.id)
					.sort(),
			).toEqual(['p-100', 'p-200'])
		} finally {
			environment.dispose()
		}
	})

	it('can batch-load parts by id without a list query', async () => {
		const environment = new PartsExampleEnvironment()

		try {
			const parts = await environment.parts.getByIds(['p-100', 'p-300'])

			expect(parts.map((part) => part.id)).toEqual(['p-100', 'p-300'])
			expect(
				environment.parts
					.values()
					.map((part) => part.id)
					.sort(),
			).toEqual(['p-100', 'p-300'])
		} finally {
			environment.dispose()
		}
	})
})
