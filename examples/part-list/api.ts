import { ApiError, createRepository, createScenario, error, loading, networkError, success } from '../../core/mock'
import type { SortingState } from '../../index'

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

export interface PartsQuery {
	offset: number
	limit: number
	sorting: SortingState<PartSortField>
	filters: PartFilters
}

export interface PartsQueryResult {
	items: readonly Part[]
	total: number
}

export interface PartRepository {
	getPartsByIds(ids: readonly string[], signal: AbortSignal): Promise<readonly Part[]>
	queryParts(query: PartsQuery, signal: AbortSignal): Promise<PartsQueryResult>
}

const seed: Record<string, Part> = {
	'p-100': { id: 'p-100', name: 'Control board', manufacturer: 'Northwind Components', price: 84 },
	'p-200': { id: 'p-200', name: 'Servo actuator', manufacturer: 'Contoso Motion', price: 142 },
	'p-300': { id: 'p-300', name: 'Pressure sensor', manufacturer: 'Fabrikam Instruments', price: 58 },
	'p-400': { id: 'p-400', name: 'Cooling fan', manufacturer: 'Tailspin Hardware', price: 21 },
	'p-500': { id: 'p-500', name: 'Relay module', manufacturer: 'Adventure Works', price: 36 },
}

function filterAndSort(query: PartsQuery): readonly Part[] {
	const filtered = Object.values(seed).filter((part) => {
		if (query.filters.manufacturer !== undefined && part.manufacturer !== query.filters.manufacturer) {
			return false
		}
		if (query.filters.minPrice !== undefined && part.price < query.filters.minPrice) {
			return false
		}
		if (query.filters.maxPrice !== undefined && part.price > query.filters.maxPrice) {
			return false
		}
		return true
	})

	return [...filtered].sort((left, right) => {
		const direction = query.sorting.direction === 'asc' ? 1 : -1
		const leftValue = left[query.sorting.field]
		const rightValue = right[query.sorting.field]
		if (leftValue < rightValue) return -1 * direction
		if (leftValue > rightValue) return direction
		return 0
	})
}

export class ApiPartsRepository implements PartRepository {
	async queryParts(query: PartsQuery, signal: AbortSignal): Promise<PartsQueryResult> {
		const response = await fetch('/api/parts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(query),
			signal,
		})
		if (!response.ok) {
			throw new ApiError(response.status, await response.json())
		}
		return response.json()
	}

	async getPartsByIds(ids: readonly string[], signal: AbortSignal): Promise<readonly Part[]> {
		const response = await fetch('/api/parts/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(ids),
			signal,
		})
		if (!response.ok) {
			throw new ApiError(response.status, await response.json())
		}
		return response.json()
	}
}

const scenarios: Record<string, PartRepository> = {
	'happy-path': createScenario<PartRepository>()
		.delay(150)
		.on('queryParts', (query) =>
			success({
				items: filterAndSort(query).slice(query.offset, query.offset + query.limit),
				total: filterAndSort(query).length,
			}),
		)
		.on('getPartsByIds', (ids) => success(ids.map((id) => seed[id]).filter(Boolean) as Part[]))
		.build(),

	'empty': createScenario<PartRepository>()
		.delay(100)
		.on('queryParts', () => success({ items: [], total: 0 }))
		.on('getPartsByIds', () => success([]))
		.build(),

	'server-error': createScenario<PartRepository>()
		.delay(200)
		.on('queryParts', error(500, { code: 'INTERNAL_ERROR', message: 'Service unavailable' }))
		.on('getPartsByIds', error(500, { code: 'INTERNAL_ERROR', message: 'Service unavailable' }))
		.build(),

	'loading': createScenario<PartRepository>()
		.on('queryParts', loading())
		.on('getPartsByIds', loading())
		.build(),

	'not-found': createScenario<PartRepository>()
		.delay(100)
		.on('queryParts', success({ items: [], total: 0 }))
		.on('getPartsByIds', error(404, { code: 'NOT_FOUND', message: 'Parts not found' }))
		.build(),
}

export function createPartsRepository(): PartRepository {
	return createRepository(() => new ApiPartsRepository(), scenarios, 'VITE_PARTS_SCENARIO')
}
