import { describe, expect, it, vi } from 'vitest'
import { createAppRuntime, createReactivityPlugin } from '../index'
import type { ListService } from '../index'

interface TestEntity {
	id: string
	name: string
	value: number
}

function makeApp() {
	return createAppRuntime({ plugins: [createReactivityPlugin()] })
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = globalThis.setTimeout(resolve, ms)

		signal?.addEventListener(
			'abort',
			() => {
				globalThis.clearTimeout(timeout)
				reject(new DOMException('Aborted', 'AbortError'))
			},
			{ once: true },
		)
	})
}

describe('ListService — server scenario', () => {
	it('withServerQuery receives correct params (sorting + filters + pagination)', async () => {
		const app = makeApp()
		const queryFn = vi.fn().mockResolvedValue({ items: [], total: 0 })

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withServerSorting({ name: 'S', initial: { field: 'name', direction: 'asc' } })
			.withServerFilters<Record<string, unknown>>({ name: 'F', initial: () => ({ active: true }) })
			.withServerPagination()
			.withServerQuery(queryFn, {
				mapResponse: (r: { items: readonly TestEntity[]; total: number }) => r,
			})
			.build()

		svc.setPageSize(10)
		await svc.loadList()

		expect(queryFn).toHaveBeenCalledOnce()
		const [params] = queryFn.mock.calls[0]
		expect(params).toMatchObject({
			sorting: { field: 'name', direction: 'asc' },
			filters: { active: true },
			offset: 0,
			limit: 10,
		})
		app.dispose()
	})

	it('loadList resets page to 1 and does replace', async () => {
		const app = makeApp()
		const allItems: TestEntity[] = [
			{ id: 'a', name: 'A', value: 1 },
			{ id: 'b', name: 'B', value: 2 },
			{ id: 'c', name: 'C', value: 3 },
		]
		let callCount = 0
		const queryFn = vi.fn().mockImplementation(async () => {
			callCount++
			return {
				items: callCount === 1 ? [allItems[0]] : [allItems[1], allItems[2]],
				total: 3,
			}
		})

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withServerPagination()
			.withServerQuery(queryFn, {
				mapResponse: (r: { items: readonly TestEntity[]; total: number }) => r,
			})
			.build()

		svc.setPageSize(1)
		await svc.loadList()
		await svc.loadNextPage()

		expect(svc.list().getIds()).toEqual(['a', 'b'])

		await svc.loadList()

		expect(svc.list().getIds()).toEqual(['b', 'c'])
		expect(svc.pagination().page).toBe(1)
		app.dispose()
	})

	it('loadNextPage appends items', async () => {
		const app = makeApp()
		const queryFn = vi.fn()
			.mockResolvedValueOnce({ items: [{ id: 'a', name: 'A', value: 1 }], total: 2 })
			.mockResolvedValueOnce({ items: [{ id: 'b', name: 'B', value: 2 }], total: 2 })

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withServerPagination()
			.withServerQuery(queryFn, {
				mapResponse: (r: { items: readonly TestEntity[]; total: number }) => r,
			})
			.build()

		svc.setPageSize(1)
		await svc.loadList()
		await svc.loadNextPage()

		expect(svc.list().getIds()).toEqual(['a', 'b'])
		expect(svc.pagination().page).toBe(2)
		app.dispose()
	})
})

describe('ListService — sorting and filters reset page', () => {
	it('setSorting resets page to 1', async () => {
		const app = makeApp()
		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withServerSorting({ name: 'S', initial: { field: 'name', direction: 'asc' } })
			.withServerPagination()
			.withServerQuery(vi.fn().mockResolvedValue({ items: [], total: 0 }), {
				mapResponse: (r: { items: readonly TestEntity[]; total: number }) => r,
			})
			.build()

		await svc.loadList()
		await svc.loadNextPage()
		expect(svc.pagination().page).toBe(2)

		svc.setSorting({ field: 'value', direction: 'desc' })
		expect(svc.pagination().page).toBe(1)
		app.dispose()
	})

	it('setFilters resets page to 1', async () => {
		const app = makeApp()
		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withServerFilters<Record<string, unknown>>({ name: 'F', initial: () => ({}) })
			.withServerPagination()
			.withServerQuery(vi.fn().mockResolvedValue({ items: [], total: 0 }), {
				mapResponse: (r: { items: readonly TestEntity[]; total: number }) => r,
			})
			.build()

		await svc.loadList()
		await svc.loadNextPage()
		expect(svc.pagination().page).toBe(2)

		svc.setFilters({ active: true })
		expect(svc.pagination().page).toBe(1)
		app.dispose()
	})
})

describe('ListService — getById / getByIds', () => {
	it('getById returns cached entity without a request', async () => {
		const app = makeApp()
		const byIdsFn = vi.fn()

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withByIdsQuery(byIdsFn)
			.build()

		svc.update({ id: 'a', name: 'A', value: 1 })

		const result = await svc.getById('a')
		expect(result).toEqual({ id: 'a', name: 'A', value: 1 })
		expect(byIdsFn).not.toHaveBeenCalled()
		app.dispose()
	})

	it('getById fetches missing entity and throws if not returned', async () => {
		const app = makeApp()
		const byIdsFn = vi.fn().mockResolvedValue([])

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withByIdsQuery(byIdsFn)
			.build()

		await expect(svc.getById('missing')).rejects.toThrow('Entity not found: missing')
		app.dispose()
	})

	it('getByIds loads only missing ids in one batch', async () => {
		const app = makeApp()
		const byIdsFn = vi.fn().mockResolvedValue([{ id: 'b', name: 'B', value: 2 }])

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withByIdsQuery(byIdsFn)
			.build()

		svc.update({ id: 'a', name: 'A', value: 1 })

		const result = await svc.getByIds(['a', 'b'])
		expect(result.map((e) => e.id)).toEqual(['a', 'b'])
		expect(byIdsFn).toHaveBeenCalledOnce()
		expect(byIdsFn.mock.calls[0][0]).toEqual(['b'])
		app.dispose()
	})

	it('getByIds tracks loading per entity', async () => {
		const app = makeApp()
		let resolveRequest!: (v: TestEntity[]) => void
		const batchRequest = new Promise<TestEntity[]>((resolve) => {
			resolveRequest = resolve
		})
		const byIdsFn = vi.fn().mockReturnValue(batchRequest)

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withLoading()
			.withByIdsQuery(byIdsFn)
			.build()

		const loadPromise = svc.getByIds(['a', 'b'])

		await delay(0)
		expect(svc.loading(['Test', 'entity', 'a'])).toBe('loading')
		expect(svc.loading(['Test', 'entity', 'b'])).toBe('loading')

		resolveRequest([
			{ id: 'a', name: 'A', value: 1 },
			{ id: 'b', name: 'B', value: 2 },
		])
		await loadPromise

		expect(svc.loading(['Test', 'entity', 'a'])).toBe('idle')
		expect(svc.loading(['Test', 'entity', 'b'])).toBe('idle')
		app.dispose()
	})
})

describe('ListService — hybrid scenario', () => {
	it('withQuery is called without params, loading and abort work', async () => {
		const app = makeApp()
		const items: TestEntity[] = [{ id: 'x', name: 'X', value: 10 }]
		const queryFn = vi.fn().mockResolvedValue(items)

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withLoading()
			.withAbort()
			.withQuery(queryFn)
			.build()

		const loadPromise = svc.loadList()
		expect(svc.loading()).toBe('loading')

		await loadPromise

		expect(svc.loading()).toBe('idle')
		expect(queryFn).toHaveBeenCalledOnce()
		expect(queryFn.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
		expect(svc.list().getIds()).toEqual(['x'])
		app.dispose()
	})

	it('client sorting is available in hybrid scenario', async () => {
		const app = makeApp()

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withQuery(vi.fn().mockResolvedValue([]))
			.withClientSorting({ name: 'S', initial: { field: 'name', direction: 'asc' } })
			.withClientPagination()
			.build()

		expect(svc.sorting()).toEqual({ field: 'name', direction: 'asc' })
		svc.setSorting({ field: 'value', direction: 'desc' })
		expect(svc.sorting()).toEqual({ field: 'value', direction: 'desc' })
		app.dispose()
	})
})

describe('ListService — client-only scenario', () => {
	it('loadList throws when no query is configured', async () => {
		const app = makeApp()

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withClientSorting({ name: 'S', initial: { field: 'name', direction: 'asc' } })
			.withClientFilters<Record<string, unknown>>({ name: 'F', initial: () => ({}) })
			.build()

		await expect(svc.loadList()).rejects.toThrow('query is not configured')
		app.dispose()
	})

	it('sorting and filters are accessible without a query', () => {
		const app = makeApp()

		const svc = app
			.createListService<TestEntity>({ name: 'Test', getId: (e) => e.id })
			.withClientSorting({ name: 'S', initial: { field: 'name', direction: 'asc' } })
			.withClientFilters<Record<string, unknown>>({ name: 'F', initial: () => ({ tag: 'all' }) })
			.build()

		expect(svc.sorting()).toEqual({ field: 'name', direction: 'asc' })
		expect(svc.filters()).toEqual({ tag: 'all' })

		svc.update({ id: 'a', name: 'A', value: 1 })
		expect(svc.values()).toHaveLength(1)
		app.dispose()
	})
})
