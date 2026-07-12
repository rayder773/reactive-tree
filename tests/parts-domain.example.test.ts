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
			environment.pagination.setPageSize(2, mainListKey)
			environment.pagination.setPageSize(2, searchListKey)
			environment.partsDomain.setSorting(
				{ field: 'price', direction: 'desc' },
				mainListKey,
			)
			environment.partsDomain.setSorting(
				{ field: 'price', direction: 'desc' },
				searchListKey,
			)
			environment.partsDomain.setFilters({ maxPrice: 84 }, searchListKey)

			await environment.partsDomain.loadList(mainListKey)
			await environment.partsDomain.loadList(searchListKey)

			environment.partsDomain.setSorting(
				{ field: 'manufacturer', direction: 'asc' },
				searchListKey,
			)
			environment.partsDomain.setFilters({ minPrice: 50 }, mainListKey)

			expect(
				environment.parts
					.values()
					.map((part) => part.id)
					.sort(),
			).toEqual(['p-100', 'p-200', 'p-300'])
			expect(
				environment.parts.values().filter((part) => part.id === 'p-100'),
			).toHaveLength(1)
			expect(environment.partsDomain.getListIds(mainListKey)).toEqual([
				'p-200',
				'p-100',
			])
			expect(environment.partsDomain.getListIds(searchListKey)).toEqual([
				'p-100',
				'p-300',
			])
			expect(environment.pagination.get(mainListKey)).toEqual({
				page: 1,
				pageSize: 2,
				total: 5,
			})
			expect(environment.pagination.get(searchListKey)).toEqual({
				page: 1,
				pageSize: 2,
				total: 4,
			})
			expect(environment.sorting.get(mainListKey)).toEqual({
				field: 'price',
				direction: 'desc',
			})
			expect(environment.sorting.get(searchListKey)).toEqual({
				field: 'manufacturer',
				direction: 'asc',
			})
			expect(environment.filters.get(mainListKey)).toEqual({
				minPrice: 50,
			})
			expect(environment.filters.get(searchListKey)).toEqual({ maxPrice: 84 })

			environment.partsDomain.updatePart({
				id: 'p-100',
				name: 'Updated board',
				manufacturer: 'Northwind Components',
				price: 85,
			})

			expect(environment.partsDomain.getList(mainListKey)[1]?.name).toBe(
				'Updated board',
			)
			expect(environment.partsDomain.getList(searchListKey)[0]?.name).toBe(
				'Updated board',
			)

			environment.partsDomain.clearList(mainListKey)

			expect(environment.partsDomain.getListIds(mainListKey)).toEqual([])
			expect(environment.partsDomain.getListIds(searchListKey)).toEqual([
				'p-100',
				'p-300',
			])

			environment.partsDomain.deletePart('p-100')

			expect(environment.partsDomain.getListIds(mainListKey)).toEqual([])
			expect(environment.partsDomain.getListIds(searchListKey)).toEqual([
				'p-300',
			])
		} finally {
			environment.dispose()
		}
	})

	it('can load the next page into a mapped list', async () => {
		const environment = new PartsExampleEnvironment()

		try {
			environment.pagination.setPageSize(1, mainListKey)
			environment.partsDomain.setSorting(
				{ field: 'price', direction: 'desc' },
				mainListKey,
			)
			await environment.partsDomain.loadList(mainListKey)
			await environment.partsDomain.loadNextPage(mainListKey)

			expect(environment.partsDomain.getListIds(mainListKey)).toEqual([
				'p-200',
				'p-100',
			])
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
			environment.pagination.setPageSize(1, mainListKey)
			environment.partsDomain.setSorting(
				{ field: 'price', direction: 'desc' },
				mainListKey,
			)
			await environment.partsDomain.loadList(mainListKey)
			await environment.partsDomain.loadNextPage(mainListKey)
			environment.pagination.setPageSize(2, mainListKey)
			await environment.partsDomain.loadList(mainListKey)

			expect(environment.partsDomain.getListIds(mainListKey)).toEqual([
				'p-200',
				'p-100',
			])
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
			const parts = await environment.partsDomain.getPartsByIds([
				'p-100',
				'p-300',
			])

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
