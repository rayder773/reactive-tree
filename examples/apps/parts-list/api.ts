import { ApiError, createRepository, createScenario, error, loading, success } from '../../../core'
import type { Part, PartFilters, PartSortField } from './parts.types'

export interface PartsQuery {
  readonly offset: number
  readonly limit: number
  readonly sorting: { readonly field: PartSortField; readonly direction: 'asc' | 'desc' }
  readonly filters: PartFilters
}

export interface PartsQueryResult {
  readonly items: readonly Part[]
  readonly total: number
}

export interface PartRepository {
  queryParts(query: PartsQuery, signal: AbortSignal): Promise<PartsQueryResult>
  getPartsByIds(ids: readonly number[], signal: AbortSignal): Promise<readonly Part[]>
}

const seed: Readonly<Record<number, Part>> = {
  1: { id: 1, name: 'Drive belt', manufacturer: 'Northwind', price: 18.5, stock: 42 },
  2: { id: 2, name: 'Bearing', manufacturer: 'Contoso', price: 7.25, stock: 120 },
  3: { id: 3, name: 'Hydraulic pump', manufacturer: 'Adventure Works', price: 189, stock: 8 },
  4: { id: 4, name: 'Pressure valve', manufacturer: 'Northwind', price: 34.75, stock: 23 },
  5: { id: 5, name: 'Control relay', manufacturer: 'Contoso', price: 22, stock: 67 },
  6: { id: 6, name: 'Seal kit', manufacturer: 'Northwind', price: 12.4, stock: 95 },
}

const querySeed = (query: PartsQuery): readonly Part[] => {
  const filtered = Object.values(seed).filter((part) => (
    !query.filters.manufacturer || part.manufacturer === query.filters.manufacturer
  ))
  const direction = query.sorting.direction === 'asc' ? 1 : -1
  return filtered.sort((left, right) => {
    const leftValue = left[query.sorting.field]
    const rightValue = right[query.sorting.field]
    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return direction * leftValue.localeCompare(rightValue)
    }
    return direction * (Number(leftValue) - Number(rightValue))
  })
}

const parseErrorBody = async (response: Response): Promise<unknown> => {
  try { return await response.json() } catch { return null }
}

export class ApiPartsRepository implements PartRepository {
  async queryParts(query: PartsQuery, signal: AbortSignal): Promise<PartsQueryResult> {
    const response = await fetch('/api/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      signal,
    })
    if (!response.ok) throw new ApiError(response.status, await parseErrorBody(response))
    return response.json() as Promise<PartsQueryResult>
  }

  async getPartsByIds(ids: readonly number[], signal: AbortSignal): Promise<readonly Part[]> {
    const response = await fetch('/api/parts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
      signal,
    })
    if (!response.ok) throw new ApiError(response.status, await parseErrorBody(response))
    return response.json() as Promise<readonly Part[]>
  }
}

const happyPath = createScenario<PartRepository>()
  .delay(150)
  .on('queryParts', (query) => {
    const items = querySeed(query)
    return success({ items: items.slice(query.offset, query.offset + query.limit), total: items.length })
  })
  .on('getPartsByIds', (ids) => success(ids.flatMap((id) => seed[id] ? [seed[id]] : [])))
  .build()

const scenarios = {
  'happy-path': happyPath,
  empty: createScenario<PartRepository>()
    .on('queryParts', success({ items: [], total: 0 }))
    .on('getPartsByIds', success([]))
    .build(),
  'server-error': createScenario<PartRepository>()
    .on('queryParts', error(500, { code: 'INTERNAL_ERROR', message: 'Service unavailable' }))
    .on('getPartsByIds', error(500, { code: 'INTERNAL_ERROR', message: 'Service unavailable' }))
    .build(),
  loading: createScenario<PartRepository>()
    .on('queryParts', loading())
    .on('getPartsByIds', loading())
    .build(),
  'not-found': createScenario<PartRepository>()
    .on('queryParts', success({ items: [], total: 0 }))
    .on('getPartsByIds', error(404, { code: 'NOT_FOUND', message: 'Parts not found' }))
    .build(),
} satisfies Readonly<Record<string, PartRepository>> & { readonly 'happy-path': PartRepository }

export const createPartsRepository = (): PartRepository => (
  createRepository(() => new ApiPartsRepository(), scenarios, 'VITE_PARTS_SCENARIO')
)
