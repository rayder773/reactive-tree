import {
	query,
	queryConcurrencyExhaust,
	queryConcurrencyLatest,
	queryConcurrencyParallel,
	queryConcurrencyQueue,
	queryFiltering,
	queryLoading,
	queryPagination,
	querySorting,
} from '../core'
import { createPartsRepository } from '../examples/apps/parts-list/api'
import type {
	Part,
	PartFilters,
	PartSortField,
} from '../examples/apps/parts-list/parts.types'

interface Row {
	id: number
	label: string
}

const row = (id: number): Row => ({ id, label: `row-${id}` })

const partsRequest = {
	offset: 0,
	limit: 2,
	sorting: { field: 'name', direction: 'asc' },
	filters: { manufacturer: null },
} as const

const deferred = <T>() => {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})
	return { promise, resolve }
}

describe('query', () => {
	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllEnvs()
	})

	it('runs a repository request independently from an entity list', async () => {
		vi.useFakeTimers()
		vi.stubEnv('VITE_PARTS_SCENARIO', 'happy-path')
		const repository = createPartsRepository()
		const parts = query<Part>().request(({ signal }) =>
			repository
				.queryParts(partsRequest, signal)
				.then((result) => result.items),
		)

		const request = parts.replace()
		await vi.advanceTimersByTimeAsync(150)

		await expect(request).resolves.toMatchObject({
			status: 'applied',
			operationId: 1,
			entities: [
				expect.objectContaining({ name: 'Bearing' }),
				expect.objectContaining({ name: 'Control relay' }),
			],
		})
	})

	it('tracks loading before and after a successful delayed request', async () => {
		vi.useFakeTimers()
		vi.stubEnv('VITE_PARTS_SCENARIO', 'happy-path')
		const repository = createPartsRepository()
		const parts = query<Part>()
			.use(queryLoading())
			.request(({ signal }) =>
				repository
					.queryParts(partsRequest, signal)
					.then((result) => result.items),
			)

		expect(parts.loading.state.get()).toEqual({ status: 'idle', error: null })
		const request = parts.replace()
		expect(parts.loading.state.get()).toEqual({
			status: 'loading',
			error: null,
		})
		expect(parts.loading.activeCount.get()).toBe(1)

		await vi.advanceTimersByTimeAsync(149)
		expect(parts.loading.state.get().status).toBe('loading')
		await vi.advanceTimersByTimeAsync(1)
		await request

		expect(parts.loading.state.get()).toEqual({ status: 'idle', error: null })
		expect(parts.loading.activeCount.get()).toBe(0)
	})

	it('keeps a failed request error in loading state', async () => {
		vi.useFakeTimers()
		vi.stubEnv('VITE_PARTS_SCENARIO', 'server-error')
		const repository = createPartsRepository()
		const parts = query<Part>()
			.use(queryLoading())
			.request(({ signal }) =>
				repository
					.queryParts(partsRequest, signal)
					.then((result) => result.items),
			)

		const request = parts.replace()
		const rejection = expect(request).rejects.toMatchObject({
			status: 500,
		})
		expect(parts.loading.state.get().status).toBe('loading')
		await vi.runAllTimersAsync()
		await rejection
		expect(parts.loading.state.get()).toMatchObject({
			status: 'error',
			error: { status: 500 },
		})
		expect(parts.loading.activeCount.get()).toBe(0)

		parts.loading.reset()
		expect(parts.loading.state.get()).toEqual({ status: 'idle', error: null })
	})

	it('exposes sorting, filtering and pagination through the chain', async () => {
		const states: unknown[] = []
		const parts = query<Part>()
			.use(
				querySorting<PartSortField>({ field: 'name', direction: 'asc' }),
			)
			.use(queryFiltering<PartFilters>({ manufacturer: null }))
			.use(queryPagination({ pageSize: 25 }))
			.request(async ({ sorting, filtering, pagination }) => {
				states.push({
					sorting: sorting.state.get(),
					filtering: filtering.state.get(),
					pagination: pagination.state.get(),
				})
				return []
			})

		parts.sorting.set({ field: 'price', direction: 'desc' })
		parts.filtering.patch({ manufacturer: 'Northwind' })
		parts.pagination.setPage(2)
		parts.pagination.setTotal(30)
		await parts.replace()

		expect(states).toEqual([
			{
				sorting: { field: 'price', direction: 'desc' },
				filtering: { manufacturer: 'Northwind' },
				pagination: { page: 2, pageSize: 25, total: 30 },
			},
		])

		parts.sorting.reset()
		parts.filtering.reset()
		parts.pagination.reset()
		expect(parts.sorting.state.get()).toEqual({
			field: 'name',
			direction: 'asc',
		})
		expect(parts.filtering.state.get()).toEqual({ manufacturer: null })
		expect(parts.pagination.state.get()).toEqual({
			page: 1,
			pageSize: 25,
			total: 0,
		})
	})

	it('supports replace and append commands', async () => {
		const rows = query<Row, number>().request(async ({ input }) => [row(input)])

		await expect(rows.replace(1)).resolves.toMatchObject({
			status: 'applied',
			operationId: 1,
			entities: [row(1)],
		})
		await expect(rows.append(2)).resolves.toMatchObject({
			status: 'applied',
			operationId: 2,
			entities: [row(2)],
		})
	})
})

describe('query concurrency', () => {
	it('runs parallel requests and publishes every active id', async () => {
		const requests = [deferred<readonly Row[]>(), deferred<readonly Row[]>()]
		const rows = query<Row, number>()
			.use(queryConcurrencyParallel<Row, number>())
			.request(({ input }) => requests[input].promise)
		const first = rows.replace(0)
		const second = rows.replace(1)

		expect(rows.concurrency.strategy).toBe('parallel')
		expect(rows.concurrency.activeIds.get()).toEqual([1, 2])
		requests[0].resolve([row(1)])
		await first
		expect(rows.concurrency.activeIds.get()).toEqual([2])
		requests[1].resolve([row(2)])
		await second
		expect(rows.concurrency.activeIds.get()).toEqual([])
	})

	it('applies only the latest request and aborts the superseded one', async () => {
		const latestRequest = deferred<readonly Row[]>()
		let firstSignal: AbortSignal | undefined
		const rows = query<Row, number>()
			.use(
				queryConcurrencyLatest<Row, number>({ cancelPrevious: true }),
			)
			.request(({ input, signal }) => {
				if (input === 2) return latestRequest.promise
				firstSignal = signal
				return new Promise<readonly Row[]>((_resolve, reject) => {
					signal.addEventListener(
						'abort',
						() => reject(new DOMException('Aborted', 'AbortError')),
						{ once: true },
					)
				})
			})
		const first = rows.replace(1)
		const latest = rows.replace(2)

		expect(firstSignal?.aborted).toBe(true)
		await expect(first).resolves.toMatchObject({
			status: 'skipped',
			reason: 'superseded',
		})
		latestRequest.resolve([row(2)])
		await expect(latest).resolves.toMatchObject({ status: 'applied' })
	})

	it('queues requests and publishes pending ids', async () => {
		const requests = [deferred<readonly Row[]>(), deferred<readonly Row[]>()]
		const rows = query<Row, number>()
			.use(queryConcurrencyQueue<Row, number>())
			.request(({ input }) => requests[input].promise)
		const first = rows.replace(0)
		const second = rows.append(1)

		expect(rows.concurrency.activeIds.get()).toEqual([1])
		expect(rows.concurrency.pendingIds.get()).toEqual([2])
		requests[0].resolve([row(1)])
		await first
		await vi.waitFor(() => {
			expect(rows.concurrency.activeIds.get()).toEqual([2])
		})
		expect(rows.concurrency.pendingIds.get()).toEqual([])
		requests[1].resolve([row(2)])
		await second
		expect(rows.concurrency.activeIds.get()).toEqual([])
	})

	it('skips a new exhaust request while another is active', async () => {
		const request = deferred<readonly Row[]>()
		const rows = query<Row>()
			.use(queryConcurrencyExhaust<Row>())
			.request(() => request.promise)
		const first = rows.replace()

		await expect(rows.replace()).resolves.toMatchObject({
			status: 'skipped',
			reason: 'busy',
		})
		request.resolve([row(1)])
		await expect(first).resolves.toMatchObject({ status: 'applied' })
	})

	it('cancels active and queued requests', async () => {
		const request = deferred<readonly Row[]>()
		const rows = query<Row, number>()
			.use(queryConcurrencyQueue<Row, number>())
			.request(({ input }) =>
				input === 1 ? request.promise : Promise.resolve([row(2)]),
			)
		const first = rows.replace(1)
		const second = rows.append(2)

		rows.concurrency.cancel(2)
		await expect(second).resolves.toMatchObject({
			status: 'skipped',
			reason: 'cancelled',
		})
		rows.concurrency.cancelAll()
		await expect(first).resolves.toMatchObject({
			status: 'skipped',
			reason: 'cancelled',
		})
		await vi.waitFor(() => {
			expect(rows.concurrency.activeIds.get()).toEqual([])
		})
	})

	it('settles active requests as disposed', async () => {
		const request = deferred<readonly Row[]>()
		const rows = query<Row>().request(() => request.promise)
		const result = rows.replace()

		rows.dispose()

		await expect(result).resolves.toMatchObject({
			status: 'skipped',
			reason: 'disposed',
		})
	})
})
