import { describe, expect, it, vi } from 'vitest'
import { createAppRuntime, DEFAULT_STORE_KEY } from '../index'

describe('Store', () => {
	it('uses a default key when no key is provided', () => {
		const app = createAppRuntime()
		const store = app.createStore<{ theme: string }>()

		store.set({ theme: 'dark' })

		expect(store.get()).toEqual({ theme: 'dark' })
		expect(store.get(DEFAULT_STORE_KEY)).toEqual({ theme: 'dark' })
	})

	it('normalizes array keys so order does not matter', () => {
		const app = createAppRuntime()
		const store = app.createStore<string>()

		store.set('value', ['part:1', 'view:a'])

		expect(store.get(['view:a', 'part:1'])).toBe('value')
		expect(store.has(['view:a', 'part:1'])).toBe(true)
	})
})

describe('services', () => {
	it('updates loading state around successful and failed callbacks', async () => {
		const app = createAppRuntime()
		const loading = app.createLoadingService()

		await loading.run(() => 'done', 'users')

		expect(loading.get('users')).toBe('idle')

		await expect(
			loading.run(() => {
				throw new Error('failed')
			}, 'users'),
		).rejects.toThrow('failed')

		expect(loading.get('users')).toBe('error')
	})

	it('aborts the previous controller for the same key', async () => {
		const app = createAppRuntime()
		const abort = app.createAbortService()
		const first = vi.fn()

		await abort.run((signal) => {
			signal.addEventListener('abort', first)
		}, 'users')
		await abort.run(() => undefined, 'users')

		expect(first).toHaveBeenCalledTimes(1)
	})

	it('stores pagination state through injected storage', () => {
		const app = createAppRuntime()
		const pagination = app.createPaginationService()

		pagination.setPage(3, 'todos')
		pagination.setPageSize(50, 'todos')

		expect(pagination.get('todos')).toEqual({
			page: 1,
			pageSize: 50,
			total: 0,
		})
	})
})

describe('AppRuntime', () => {
	it('emits store events for plugins', () => {
		const events: string[] = []
		const app = createAppRuntime({
			plugins: [
				{
					name: 'TestPlugin',
					afterStoreGet: (context) =>
						events.push(`get:${context.normalizedKey}`),
					afterStoreSet: (context) =>
						events.push(`set:${context.normalizedKey}`),
				},
			],
		})
		const store = app.createStore<number>()

		store.set(2, 'count')
		expect(store.get('count')).toBe(2)
		expect(events).toEqual(['set:count', 'get:count'])
		app.dispose()
	})
})
