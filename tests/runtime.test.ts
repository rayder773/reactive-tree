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

		expect(pagination.get('todos')).toEqual({
			page: 1,
			pageSize: 50,
			total: 0,
		})
	})
})

describe('AppRuntime', () => {
	it('declares service and store dependencies before methods run', () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })

		app.createLoadingService()

		const snapshot = graph.getSnapshot()
		const loadingNode = snapshot.nodes.find(
			(node) => node.label === 'LoadingService',
		)
		const storeNode = snapshot.nodes.find(
			(node) => node.label === 'LoadingStore',
		)

		expect(loadingNode?.kind).toBe('object')
		expect(storeNode?.kind).toBe('object')
		expect(
			snapshot.edges.find(
				(edge) => edge.from === loadingNode?.id && edge.to === storeNode?.id,
			)?.type,
		).toBe('uses')
	})

	it('declares registered object dependencies before methods run', () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const users = app.createStore<{ id: string }>({ name: 'UsersStore' })

		class UserWorkflow {}

		app.register(new UserWorkflow(), { dependencies: [users] })

		const snapshot = graph.getSnapshot()
		const workflowNode = snapshot.nodes.find(
			(node) => node.label === 'UserWorkflow',
		)
		const usersNode = snapshot.nodes.find((node) => node.label === 'UsersStore')

		expect(
			snapshot.edges.find(
				(edge) => edge.from === workflowNode?.id && edge.to === usersNode?.id,
			)?.type,
		).toBe('uses')
	})

	it('wraps registered objects and builds an aggregated dependency graph', () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const store = app.createStore<number>({ name: 'CounterStore' })

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
		actions.increment()

		const snapshot = graph.getSnapshot()
		const labels = snapshot.nodes.map((node) => node.label)
		const incrementNode = snapshot.nodes.find(
			(node) => node.label === 'CounterActions.increment',
		)
		const saveNode = snapshot.nodes.find(
			(node) => node.label === 'CounterActions.save',
		)

		expect(labels).toContain('CounterActions.increment')
		expect(labels).toContain('CounterActions.save')
		expect(labels).toContain('CounterStore.get(count)')
		expect(labels).toContain('CounterStore.set(count = 1)')
		expect(labels).toContain('CounterStore.set(count = 2)')
		expect(incrementNode?.count).toBe(2)
		expect(saveNode?.count).toBe(2)
		expect(
			snapshot.edges.find(
				(edge) => edge.from === incrementNode?.id && edge.to === saveNode?.id,
			)?.count,
		).toBe(2)
		expect(store.get('count')).toBe(2)
	})

	it('does not track injected function fields as object methods', async () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const loading = app.createLoadingService()

		await loading.run(() => undefined, 'users')

		const labels = graph.getSnapshot().nodes.map((node) => node.label)

		expect(labels).toContain('LoadingService.run')
		expect(labels).toContain('LoadingService.run callback')
		expect(labels).not.toContain('LoadingService.executeAsync')
	})

	it('tracks concrete service store keys', async () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const loading = app.createLoadingService()

		await loading.run(() => undefined, 'load-user:user-1')
		loading.get('load-user:user-1')

		const labels = graph.getSnapshot().nodes.map((node) => node.label)

		expect(labels).toContain('LoadingStore.set(load-user:user-1 = loading)')
		expect(labels).toContain('LoadingStore.set(load-user:user-1 = idle)')
		expect(labels).toContain('LoadingStore.get(load-user:user-1)')
	})

	it('keeps async callback nodes scoped to their parent operation', async () => {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const loading = app.createLoadingService()
		const abort = app.createAbortService()

		await loading.run(async () => {
			await abort.run(() => undefined, 'load-user:user-1')
		}, 'load-user:user-1')

		const labels = graph.getSnapshot().nodes.map((node) => node.label)

		expect(labels).toContain('LoadingService.run callback')
		expect(labels).toContain('AbortService.run callback')
		expect(labels).not.toContain('callback')
	})
})
