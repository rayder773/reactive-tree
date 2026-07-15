import { createUiRuntime, type UiRuntime } from '../../core/ui/UiRuntime'
import {
	type AppRuntime,
	createAppRuntime,
	createReactivityPlugin,
	type DependencyGraphPlugin,
	dependencyGraphPlugin,
	type ListService,
	type SortingState,
} from '../../index'

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

export class PartsExampleEnvironment {
	readonly graph: DependencyGraphPlugin
	readonly app: AppRuntime
	readonly ui: UiRuntime
	readonly parts: ListService<Part>
	readonly repository: PartRepository

	constructor() {
		const reactivity = createReactivityPlugin()
		this.graph = dependencyGraphPlugin()
		this.app = createAppRuntime({ plugins: [this.graph, reactivity] })
		this.ui = createUiRuntime(reactivity)
		this.repository = this.app.register(new FakePartsRepository(), {
			name: 'FakePartsRepository',
		})

		const repository = this.repository
		this.parts = this.app
			.createListService<Part>({ name: 'Parts', getId: (p) => p.id })
			.withLoading()
			.withAbort()
			.withServerSorting<PartSortField>({
				name: 'PartsSorting',
				initial: { field: 'name', direction: 'asc' },
			})
			.withServerFilters<PartFilters>({
				name: 'PartsFilters',
				initial: () => ({}),
			})
			.withServerPagination()
			.withServerQuery(
				(params, signal) =>
					repository.queryParts(params as unknown as PartsQuery, signal),
				{ mapResponse: (r) => ({ items: r.items, total: r.total }) },
			)
			.withByIdsQuery((ids, signal) => repository.getPartsByIds(ids, signal))
			.build()
	}

	dispose(): void {
		this.app.dispose()
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
		await delay(120, signal)

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
		await delay(120, signal)

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
