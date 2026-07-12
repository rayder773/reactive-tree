import { describe, expect, it, vi } from 'vitest'
import {
	createAppRuntime,
	DEFAULT_STORE_KEY,
	dependencyGraphPlugin,
} from '../index'

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

		expect(pagination.get('todos')).toEqual({ page: 1, pageSize: 50 })
	})
})

describe('AppRuntime', () => {
	it('wraps registered objects and tracks nested method calls', () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const store = app.createStore<number>()

		class CounterActions {
			increment() {
				const current = store.get('count') ?? 0
				this.save(current + 1)
			}

			save(value: number) {
				store.set(value, 'count')
			}
		}

		const actions = app.register(new CounterActions())
		actions.increment()

		const labels = graph.getSnapshot().nodes.map((node) => node.label)

		expect(labels).toContain('CounterActions.increment')
		expect(labels).toContain('CounterActions.save')
		expect(labels).toContain('Store.get(count)')
		expect(labels).toContain('Store.set(count)')
		expect(store.get('count')).toBe(1)
	})
})
