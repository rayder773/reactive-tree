import {
	type AbortService,
	createAppRuntime,
	dependencyGraphPlugin,
	type LoadingService,
	type PaginationService,
	type StoreContract,
} from '../../index'
import type { ExampleDefinition, ExampleInstance } from '../types'

interface User {
	id: string
	name: string
}

interface Todo {
	id: string
	userId: string
	title: string
}

class UserWorkflow {
	constructor(
		private readonly users: StoreContract<User>,
		private readonly todos: StoreContract<Todo[]>,
		private readonly loading: LoadingService,
		private readonly abort: AbortService,
		private readonly pagination: PaginationService,
	) {}

	async loadUser(userId: string): Promise<void> {
		const requestKey = getUserRequestKey(userId)

		await this.loading.run(async () => {
			await this.abort.run(async (signal) => {
				await delay(250, signal)
				const user = { id: userId, name: 'Ada Lovelace' }
				this.saveUser(user)
				this.saveTodos(user.id)
			}, requestKey)
		}, requestKey)
	}

	async restartUserLoad(): Promise<void> {
		void this.loadUser('user-1').catch(() => undefined)
		await this.loadUser('user-1')
	}

	nextPage(): void {
		const current = this.pagination.get('todos')
		this.pagination.setPage(current.page + 1, 'todos')
	}

	private saveUser(user: User): void {
		this.users.set(user, user.id)
	}

	private saveTodos(userId: string): void {
		const page = this.pagination.get('todos').page
		this.todos.set(
			[
				{
					id: `todo-${page}`,
					userId,
					title: `Review architecture notes page ${page}`,
				},
			],
			['todos', userId, `page:${page}`],
		)
	}
}

const basicRuntimeExample: ExampleDefinition = {
	id: 'basic-runtime',
	title: 'Basic Runtime',
	description:
		'Runtime creation, stores, infrastructure services, nested calls, and dependency graph output.',
	mount({ element }): ExampleInstance {
		const graph = dependencyGraphPlugin()
		const app = createAppRuntime({ plugins: [graph] })
		const users = app.createStore<User>({ name: 'UsersStore' })
		const todos = app.createStore<Todo[]>({ name: 'TodosStore' })
		const loading = app.createLoadingService()
		const abort = app.createAbortService()
		const pagination = app.createPaginationService()
		const workflow = app.register(
			new UserWorkflow(users, todos, loading, abort, pagination),
			{
				dependencies: [users, todos, loading, abort, pagination],
			},
		)

		element.innerHTML = `
			<div class="runtime-example">
				<div class="runtime-example__actions">
					<button data-action="load-user" type="button">Load user</button>
					<button data-action="abort-load" type="button">Abort previous load</button>
					<button data-action="next-page" type="button">Next page</button>
					<button data-action="print-graph" type="button">Print graph</button>
				</div>
				<pre class="runtime-example__output"></pre>
			</div>
		`

		const output = element.querySelector<HTMLPreElement>(
			'.runtime-example__output',
		)
		const abortController = new AbortController()

		element.querySelector('[data-action="load-user"]')?.addEventListener(
			'click',
			async () => {
				await workflow.loadUser('user-1')
				render()
			},
			{ signal: abortController.signal },
		)

		element.querySelector('[data-action="abort-load"]')?.addEventListener(
			'click',
			async () => {
				await workflow.restartUserLoad()
				render()
			},
			{ signal: abortController.signal },
		)

		element.querySelector('[data-action="next-page"]')?.addEventListener(
			'click',
			() => {
				workflow.nextPage()
				render()
			},
			{ signal: abortController.signal },
		)

		element.querySelector('[data-action="print-graph"]')?.addEventListener(
			'click',
			() => {
				graph.print()
				render()
			},
			{ signal: abortController.signal },
		)

		render()

		return {
			dispose() {
				abortController.abort()
				app.dispose()
			},
		}

		function render(): void {
			if (output === null) {
				return
			}

			output.textContent = JSON.stringify(
				{
					loading: loading.get(getUserRequestKey('user-1')),
					user: users.get('user-1'),
					pagination: pagination.get('todos'),
					graph: graph.getSnapshot(),
				},
				null,
				2,
			)
		}
	},
}

export default basicRuntimeExample

function getUserRequestKey(userId: string): string {
	return `load-user:${userId}`
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = window.setTimeout(resolve, ms)

		signal.addEventListener(
			'abort',
			() => {
				window.clearTimeout(timeout)
				reject(new DOMException('Aborted', 'AbortError'))
			},
			{ once: true },
		)
	})
}
