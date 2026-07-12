import {
	type AbortService,
	type AppRuntime,
	createAppRuntime,
	type DependencyGraphPlugin,
	dependencyGraphPlugin,
	type FiltersService,
	type LoadingService,
	type MappedListContract,
	type PaginationService,
	type RuntimeKey,
	type SortingService,
	type SortingState,
} from '../../index'
import type { ExampleDefinition, ExampleInstance } from '../types'

export interface Part {
	id: string
	name: string
	manufacturer: string
	price: number
}

export type PartSortField = 'name' | 'price' | 'manufacturer'

export interface PartFilters extends Record<string, unknown> {
	manufacturer?: string
	minPrice?: number
	maxPrice?: number
	inStock?: boolean
}

interface PartsQuery {
	offset: number
	limit: number
	sorting: SortingState<PartSortField>
	filters: PartFilters
}

interface PartsQueryResult {
	items: readonly Part[]
	total: number
}

interface PartRepository {
	getPartsByIds(
		ids: readonly string[],
		signal: AbortSignal,
	): Promise<readonly Part[]>
	queryParts(query: PartsQuery, signal: AbortSignal): Promise<PartsQueryResult>
}

interface PartsDomainDependencies {
	parts: MappedListContract<Part>
	sorting: SortingService<PartSortField>
	filters: FiltersService<PartFilters>
	loading: LoadingService
	abort: AbortService
	pagination: PaginationService
	repository: PartRepository
}

export class PartsExampleEnvironment {
	readonly graph: DependencyGraphPlugin
	readonly app: AppRuntime
	readonly parts: MappedListContract<Part>
	readonly sorting: SortingService<PartSortField>
	readonly filters: FiltersService<PartFilters>
	readonly loading: LoadingService
	readonly abort: AbortService
	readonly pagination: PaginationService
	readonly repository: PartRepository
	readonly partsDomain: PartsDomain

	constructor() {
		this.graph = dependencyGraphPlugin()
		this.app = createAppRuntime({ plugins: [this.graph] })
		this.parts = this.app.createMappedList<Part>({
			name: 'Parts',
			getId: (part) => part.id,
		})
		this.sorting = this.app.createSortingService<PartSortField>({
			name: 'PartsSorting',
			initial: {
				field: 'name',
				direction: 'asc',
			},
		})
		this.filters = this.app.createFiltersService<PartFilters>({
			name: 'PartsFilters',
			initial: () => ({}),
		})
		this.loading = this.app.createLoadingService()
		this.abort = this.app.createAbortService()
		this.pagination = this.app.createPaginationService()
		this.repository = this.app.register(new FakePartsRepository(), {
			name: 'FakePartsRepository',
		})
		this.partsDomain = this.app.register(
			new PartsDomain({
				parts: this.parts,
				sorting: this.sorting,
				filters: this.filters,
				loading: this.loading,
				abort: this.abort,
				pagination: this.pagination,
				repository: this.repository,
			}),
			{
				name: 'PartsDomain',
			},
		)
	}

	dispose(): void {
		this.app.dispose()
	}
}

export class PartsDomain {
	constructor(private readonly dependencies: PartsDomainDependencies) {}

	async getPartById(id: string): Promise<Part> {
		const cached = this.dependencies.parts.get(id)

		if (cached !== undefined) {
			return cached
		}

		const requestKey = getPartRequestKey(id)

		const parts = await this.loadPartsByIds([id], requestKey)
		const part = parts[0]

		if (part === undefined) {
			throw new Error(`Part was not found: ${id}`)
		}

		return part
	}

	async getPartsByIds(ids: readonly string[]): Promise<readonly Part[]> {
		const missingIds = ids.filter((id) => !this.dependencies.parts.has(id))

		if (missingIds.length > 0) {
			await this.loadPartsByIds(missingIds, ['parts', 'batch'])
		}

		return ids
			.map((id) => this.dependencies.parts.get(id))
			.filter((part): part is Part => part !== undefined)
	}

	async loadList(key?: RuntimeKey): Promise<readonly Part[]> {
		return this.loadListPage(key, 'replace')
	}

	async loadNextPage(key?: RuntimeKey): Promise<readonly Part[]> {
		const current = this.dependencies.pagination.get(key)
		this.dependencies.pagination.setPage(current.page + 1, key)
		return this.loadListPage(key, 'append')
	}

	private async loadListPage(
		key: RuntimeKey | undefined,
		mode: 'replace' | 'append',
	): Promise<readonly Part[]> {
		const list = this.dependencies.parts.list(key)
		const pagination = this.dependencies.pagination.get(key)
		const sorting = this.dependencies.sorting.get(key)
		const filters = this.dependencies.filters.get(key)
		const query: PartsQuery = {
			offset: (pagination.page - 1) * pagination.pageSize,
			limit: pagination.pageSize,
			sorting,
			filters,
		}

		return this.dependencies.loading.run(async () => {
			const result = await this.dependencies.abort.run(
				(signal) => this.dependencies.repository.queryParts(query, signal),
				key,
			)

			if (mode === 'append') {
				list.append(result.items)
			} else {
				list.set(result.items)
			}

			this.dependencies.pagination.setTotal(result.total, key)
			return this.getList(key)
		}, key)
	}

	getList(key?: RuntimeKey): readonly Part[] {
		return this.dependencies.parts.list(key).get()
	}

	getListIds(key?: RuntimeKey): readonly string[] {
		return this.dependencies.parts.list(key).getIds()
	}

	setSorting(value: SortingState<PartSortField>, key?: RuntimeKey): void {
		this.dependencies.sorting.set(value, key)
		this.dependencies.pagination.setPage(1, key)
	}

	setFilters(value: PartFilters, key?: RuntimeKey): void {
		this.dependencies.filters.set(value, key)
		this.dependencies.pagination.setPage(1, key)
	}

	updatePart(part: Part): void {
		this.dependencies.parts.set(part)
	}

	deletePart(id: string): void {
		this.dependencies.parts.delete(id)
	}

	clearList(key?: RuntimeKey): void {
		this.dependencies.parts.list(key).clear()
	}

	private async loadPartsByIds(
		ids: readonly string[],
		key: RuntimeKey,
	): Promise<readonly Part[]> {
		return this.dependencies.loading.run(async () => {
			return this.dependencies.abort.run(async (signal) => {
				const parts = await this.dependencies.repository.getPartsByIds(
					ids,
					signal,
				)
				this.dependencies.parts.setMany(parts)
				return parts
			}, key)
		}, key)
	}
}

class FakePartsRepository implements PartRepository {
	private readonly seed: Record<string, Part> = {
		'p-100': {
			id: 'p-100',
			name: 'Control board',
			manufacturer: 'Northwind Components',
			price: 84,
		},
		'p-200': {
			id: 'p-200',
			name: 'Servo actuator',
			manufacturer: 'Contoso Motion',
			price: 142,
		},
		'p-300': {
			id: 'p-300',
			name: 'Pressure sensor',
			manufacturer: 'Fabrikam Instruments',
			price: 58,
		},
		'p-400': {
			id: 'p-400',
			name: 'Cooling fan',
			manufacturer: 'Tailspin Hardware',
			price: 21,
		},
		'p-500': {
			id: 'p-500',
			name: 'Relay module',
			manufacturer: 'Adventure Works',
			price: 36,
		},
	}

	async getPartsByIds(
		ids: readonly string[],
		signal: AbortSignal,
	): Promise<readonly Part[]> {
		await delay(350, signal)

		return ids.map(
			(id) =>
				this.seed[id] ?? {
					id,
					name: `Generated part ${id}`,
					manufacturer: 'Remote catalog',
					price: 99,
				},
		)
	}

	async queryParts(
		query: PartsQuery,
		signal: AbortSignal,
	): Promise<PartsQueryResult> {
		await delay(350, signal)

		const filtered = Object.values(this.seed).filter((part) => {
			if (
				query.filters.manufacturer !== undefined &&
				part.manufacturer !== query.filters.manufacturer
			) {
				return false
			}

			if (
				query.filters.minPrice !== undefined &&
				part.price < query.filters.minPrice
			) {
				return false
			}

			if (
				query.filters.maxPrice !== undefined &&
				part.price > query.filters.maxPrice
			) {
				return false
			}

			return true
		})
		const sorted = [...filtered].sort((left, right) => {
			const direction = query.sorting.direction === 'asc' ? 1 : -1
			const leftValue = left[query.sorting.field]
			const rightValue = right[query.sorting.field]

			if (leftValue < rightValue) {
				return -1 * direction
			}

			if (leftValue > rightValue) {
				return direction
			}

			return 0
		})

		return {
			items: sorted.slice(query.offset, query.offset + query.limit),
			total: filtered.length,
		}
	}
}

export const mainListKey = ['parts', 'main'] as const
export const expensiveListKey = ['parts', 'search', 'expensive'] as const
export const manufacturerListKey = [
	'parts',
	'manufacturer',
	'northwind',
] as const
export const searchListKey = ['parts', 'search'] as const

const partsDomainExample: ExampleDefinition = {
	id: 'parts-domain',
	title: 'Parts Domain',
	description:
		'Shared mapped entity storage with keyed lists, pagination, sorting, filters, loading, and abort state.',
	mount({ element }): ExampleInstance {
		const environment = new PartsExampleEnvironment()
		const abortController = new AbortController()

		element.innerHTML = `
			<div class="parts-example">
				<div class="parts-example__toolbar">
					<label>
						<span>Part id</span>
						<input data-part-id type="text" value="p-200" />
					</label>
				</div>
				<div class="runtime-example__actions">
					<button data-action="load-main" type="button">Load main list</button>
					<button data-action="load-other" type="button">Load other lists</button>
					<button data-action="next-expensive" type="button">Load next expensive page</button>
					<button data-action="sort-main" type="button">Sort main by price</button>
					<button data-action="filter-main" type="button">Filter main</button>
					<button data-action="update-part" type="button">Update part</button>
					<button data-action="clear-main" type="button">Clear main list</button>
					<button data-action="delete-part" type="button">Delete part</button>
					<button data-action="print-graph" type="button">Print graph</button>
				</div>
				<pre class="runtime-example__output" data-output></pre>
			</div>
		`

		const output = getRequiredElement(element, '[data-output]')
		const partIdInput = getRequiredElement<HTMLInputElement>(
			element,
			'[data-part-id]',
		)

		environment.pagination.setPageSize(2, mainListKey)
		environment.pagination.setPageSize(1, expensiveListKey)
		environment.pagination.setPageSize(2, manufacturerListKey)

		bindAction('load-main', async () => {
			await environment.partsDomain.loadList(mainListKey)
			render('Loaded main list')
		})

		bindAction('load-other', async () => {
			environment.partsDomain.setSorting(
				{ field: 'price', direction: 'desc' },
				expensiveListKey,
			)
			environment.partsDomain.setFilters({ minPrice: 80 }, expensiveListKey)
			environment.partsDomain.setFilters(
				{ manufacturer: 'Northwind Components' },
				manufacturerListKey,
			)
			await environment.partsDomain.loadList(expensiveListKey)
			await environment.partsDomain.loadList(manufacturerListKey)
			render('Loaded search and manufacturer lists')
		})

		bindAction('next-expensive', async () => {
			await environment.partsDomain.loadNextPage(expensiveListKey)
			render('Loaded next expensive list page')
		})

		bindAction('sort-main', () => {
			environment.partsDomain.setSorting(
				{ field: 'price', direction: 'desc' },
				mainListKey,
			)
			render('Changed main sorting')
		})

		bindAction('filter-main', () => {
			environment.partsDomain.setFilters(
				{ manufacturer: 'Northwind Components', minPrice: 50 },
				mainListKey,
			)
			render('Changed main filters')
		})

		bindAction('update-part', () => {
			const id = getPartId()
			const current = environment.parts.get(id) ?? {
				id,
				name: `Manual part ${id}`,
				manufacturer: 'Manual updates',
				price: 100,
			}
			environment.partsDomain.updatePart({
				...current,
				name: `${current.name} (updated)`,
				price: current.price + 1,
			})
			render('Updated shared entity')
		})

		bindAction('clear-main', () => {
			environment.partsDomain.clearList(mainListKey)
			render('Cleared main list')
		})

		bindAction('delete-part', () => {
			environment.partsDomain.deletePart(getPartId())
			render('Deleted entity from shared map and all lists')
		})

		bindAction('print-graph', () => {
			environment.graph.print()
			render('Printed graph to console')
		})

		render('Ready')

		return {
			dispose() {
				abortController.abort()
				environment.dispose()
			},
		}

		function bindAction(
			action: string,
			handler: () => void | Promise<void>,
		): void {
			element
				.querySelector(`[data-action="${action}"]`)
				?.addEventListener(
					'click',
					() => void Promise.resolve(handler()).catch(renderError),
					{ signal: abortController.signal },
				)
		}

		function render(message: string): void {
			output.textContent = JSON.stringify(
				{
					message,
					selectedPart: environment.parts.get(getPartId()),
					entityMap: environment.parts.values(),
					lists: {
						main: getListSnapshot(mainListKey),
						expensive: getListSnapshot(expensiveListKey),
						manufacturer: getListSnapshot(manufacturerListKey),
					},
					graph: environment.graph.getSnapshot(),
				},
				null,
				2,
			)
		}

		function getListSnapshot(key: RuntimeKey) {
			return {
				key,
				ids: environment.partsDomain.getListIds(key),
				parts: environment.partsDomain.getList(key),
				pagination: environment.pagination.get(key),
				sorting: environment.sorting.get(key),
				filters: environment.filters.get(key),
				loading: environment.loading.get(key),
			}
		}

		function renderError(error: unknown): void {
			render(error instanceof Error ? error.message : 'Unknown error')
		}

		function getPartId(): string {
			return partIdInput.value.trim() || 'p-200'
		}
	},
}

export default partsDomainExample

function getPartRequestKey(partId: string): string {
	return `load-part:${partId}`
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = globalThis.setTimeout(resolve, ms)

		signal.addEventListener(
			'abort',
			() => {
				globalThis.clearTimeout(timeout)
				reject(new DOMException('Aborted', 'AbortError'))
			},
			{ once: true },
		)
	})
}

function getRequiredElement<T extends HTMLElement>(
	root: ParentNode,
	selector: string,
): T {
	const element = root.querySelector<T>(selector)

	if (element === null) {
		throw new Error(`Parts example element was not found: ${selector}`)
	}

	return element
}
