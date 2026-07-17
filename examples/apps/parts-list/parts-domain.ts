import {
  EntityService,
  FilteringService,
  PaginationService,
  SortingService,
  defaultDataAdapter,
  type DataAdapter,
} from '../../../core'
import type { Part, PartFilters, PartSortField } from './parts.types'

const seed: readonly Part[] = [
  { id: 1, name: 'Drive belt', manufacturer: 'Northwind', price: 18.5, stock: 42 },
  { id: 2, name: 'Bearing', manufacturer: 'Contoso', price: 7.25, stock: 120 },
  { id: 3, name: 'Hydraulic pump', manufacturer: 'Adventure Works', price: 189, stock: 8 },
  { id: 4, name: 'Pressure valve', manufacturer: 'Northwind', price: 34.75, stock: 23 },
  { id: 5, name: 'Control relay', manufacturer: 'Contoso', price: 22, stock: 67 },
  { id: 6, name: 'Seal kit', manufacturer: 'Northwind', price: 12.4, stock: 95 },
]

const compare = (left: Part, right: Part, field: PartSortField): number => {
  const a = left[field]
  const b = right[field]
  return typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b)
}

export function createPartsDomain(dataAdapter: DataAdapter = defaultDataAdapter) {
  const entities = new EntityService<Part, number, PartSortField, PartFilters>({
    getId: (part) => part.id,
    dataAdapter,
    lists: {
      source: 'entities',
      query: false,
      sorting: {
        mode: 'client',
        factory: (adapter) => new SortingService({ field: 'name', direction: 'asc' }, adapter),
        comparator: compare,
      },
      filtering: false,
      pagination: {
        mode: 'client',
        factory: (adapter) => new PaginationService({ pageSize: 3 }, adapter),
      },
    },
  })
  entities.upsertMany(seed)

  const allParts = entities.createList('all-parts')
  const northwindParts = entities.createList('northwind-parts', {
    sorting: {
      mode: 'client',
      factory: (adapter) => new SortingService({ field: 'price', direction: 'asc' }, adapter),
      comparator: compare,
    },
    filtering: {
      mode: 'client',
      factory: (adapter) => new FilteringService<PartFilters>({ manufacturer: 'Northwind' }, adapter),
      predicate: (part, filters) => !filters.manufacturer || part.manufacturer === filters.manufacturer,
    },
    pagination: false,
  })

  let nextId = Math.max(...seed.map((part) => part.id)) + 1
  return {
    entities,
    allParts,
    northwindParts,
    addPart() {
      const id = nextId++
      entities.upsert({ id, name: `New part ${id}`, manufacturer: 'Northwind', price: 25 + id, stock: 10 })
    },
    increasePrice(id: number) {
      entities.update(id, (part) => ({ ...part, price: Math.round((part.price + 1) * 100) / 100 }))
    },
    deletePart(id: number) { entities.delete(id) },
    toggleAllSort() {
      const sorting = allParts.sorting?.get()
      if (sorting) allParts.setSorting({ field: sorting.field, direction: sorting.direction === 'asc' ? 'desc' : 'asc' })
    },
    toggleNorthwindFilter() {
      const filters = northwindParts.filters?.get()
      northwindParts.patchFilters({ manufacturer: filters?.manufacturer ? null : 'Northwind' })
    },
    dispose() { entities.dispose() },
  }
}

export type PartsDomain = ReturnType<typeof createPartsDomain>
