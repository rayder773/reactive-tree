import { describe, expect, it } from 'vitest'
import { ApiError, createScenario, error, loading, networkError, success } from '../index'

interface TestRepo {
	fetchItem(id: string, signal: AbortSignal): Promise<{ id: string }>
	fetchList(limit: number, offset: number, signal: AbortSignal): Promise<{ id: string }[]>
}

function makeRepo() {
	return createScenario<TestRepo>()
		.delay(0)
		.on('fetchItem', (id) => success({ id }))
		.on('fetchList', () => success([]))
		.build()
}

describe('createScenario', () => {
	it('success(data) резолвится данными', async () => {
		const repo = makeRepo()
		const signal = new AbortController().signal
		const result = await repo.fetchItem('x', signal)
		expect(result).toEqual({ id: 'x' })
	})

	it('error(status, body) бросает ApiError с правильными status и body', async () => {
		const repo = createScenario<TestRepo>()
			.delay(0)
			.on('fetchItem', error(404, { code: 'NOT_FOUND' }))
			.on('fetchList', success([]))
			.build()

		const signal = new AbortController().signal
		await expect(repo.fetchItem('x', signal)).rejects.toBeInstanceOf(ApiError)

		try {
			await repo.fetchItem('y', new AbortController().signal)
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError)
			expect((e as ApiError).status).toBe(404)
			expect((e as ApiError).body).toEqual({ code: 'NOT_FOUND' })
		}
	})

	it('loading() никогда не резолвится', async () => {
		const repo = createScenario<TestRepo>()
			.on('fetchItem', loading())
			.on('fetchList', success([]))
			.build()

		const ac = new AbortController()
		const promise = repo.fetchItem('x', ac.signal)

		const raced = await Promise.race([
			promise.then(() => 'resolved'),
			new Promise<string>((res) => setTimeout(() => res('timeout'), 30)),
		])

		expect(raced).toBe('timeout')
		ac.abort()
	})

	it('loading() режектится с AbortError при отмене сигнала', async () => {
		const repo = createScenario<TestRepo>()
			.on('fetchItem', loading())
			.on('fetchList', success([]))
			.build()

		const ac = new AbortController()
		const promise = repo.fetchItem('x', ac.signal)
		ac.abort()

		await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
	})

	it('networkError() бросает ApiError со статусом 0', async () => {
		const repo = createScenario<TestRepo>()
			.delay(0)
			.on('fetchItem', networkError())
			.on('fetchList', success([]))
			.build()

		try {
			await repo.fetchItem('x', new AbortController().signal)
			expect.fail('должно было выброситься исключение')
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError)
			expect((e as ApiError).status).toBe(0)
			expect((e as ApiError).body).toBeNull()
		}
	})

	it('handler-функция получает аргументы запроса без AbortSignal', async () => {
		let capturedId: string | undefined
		let capturedArgs: unknown[] | undefined

		const repo = createScenario<TestRepo>()
			.delay(0)
			.on('fetchItem', (id) => {
				capturedId = id
				return success({ id })
			})
			.on('fetchList', (limit, offset) => {
				capturedArgs = [limit, offset]
				return success([])
			})
			.build()

		const signal = new AbortController().signal
		await repo.fetchItem('abc', signal)
		expect(capturedId).toBe('abc')

		await repo.fetchList(10, 5, signal)
		expect(capturedArgs).toEqual([10, 5])
	})

	it('глобальный delay применяется к success и error', async () => {
		const repo = createScenario<TestRepo>()
			.delay(50)
			.on('fetchItem', success({ id: 'x' }))
			.on('fetchList', error(500, null))
			.build()

		const signal = new AbortController().signal

		const start = Date.now()
		await repo.fetchItem('x', signal)
		expect(Date.now() - start).toBeGreaterThanOrEqual(40)

		const start2 = Date.now()
		await repo.fetchList(10, 0, signal).catch(() => {})
		expect(Date.now() - start2).toBeGreaterThanOrEqual(40)
	})

	it('loading() режектится по abort независимо от delay', async () => {
		const repo = createScenario<TestRepo>()
			.delay(10_000)
			.on('fetchItem', loading())
			.on('fetchList', success([]))
			.build()

		const ac = new AbortController()
		const promise = repo.fetchItem('x', ac.signal)
		ac.abort()

		await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
	})

	it('TypeScript: build() не компилируется без описания всех методов', () => {
		const builder = createScenario<TestRepo>().on('fetchItem', success({ id: 'x' }))
		// @ts-expect-error — TDefined не включает fetchList, build() должен выдать ошибку
		builder.build()
	})
})
