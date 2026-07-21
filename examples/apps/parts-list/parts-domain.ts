import { allEntities, entityLists, entityStore, filtering, identity, sorting } from '../../../core'
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

interface ManufacturerArgs { manufacturer: Part['manufacturer'] }

export function createPartsDomain() {
  const entities = entityStore<Part>()
    .use(identity((part) => part.id))
    .build()
  const lists = entityLists(entities).build()
  entities.upsertMany(seed)

  const allParts = lists
    .create('all-parts')
    .use(allEntities())
    .use(sorting({ initial: { field: 'name', direction: 'asc' }, compare }))
    .build()

  const manufacturerDefinition = lists.define(
    (list, args: ManufacturerArgs) => list
      .use(allEntities())
      .use(filtering<Part, PartFilters>({
        initial: { manufacturer: args.manufacturer },
        predicate: (part, filters) => !filters.manufacturer || part.manufacturer === filters.manufacturer,
      }))
      .use(sorting({ initial: { field: 'price', direction: 'asc' }, compare })),
  )
  const manufacturerViews = lists.group('manufacturer-views', manufacturerDefinition)
  manufacturerViews.create('Northwind', { manufacturer: 'Northwind' })

  let nextId = Math.max(...seed.map((part) => part.id)) + 1
  return {
    entities,
    lists,
    allParts,
    manufacturerViews,
    manufacturers: ['Northwind', 'Contoso', 'Adventure Works'] as const,
    addPart() {
      const id = nextId++
      entities.upsert({ id, name: `New part ${id}`, manufacturer: 'Northwind', price: 25 + id, stock: 10 })
    },
    increasePrice(id: number) {
      entities.update(id, (part) => ({ ...part, price: Math.round((part.price + 1) * 100) / 100 }))
    },
    deletePart(id: number) { entities.delete(id) },
    toggleAllSort() {
      const current = allParts.sorting.state.get()
      allParts.sorting.setDirection(current.direction === 'asc' ? 'desc' : 'asc')
    },
    createManufacturerView(manufacturer: Part['manufacturer']) {
      return manufacturerViews.create(manufacturer, { manufacturer })
    },
    deleteManufacturerView(manufacturer: PartFilters['manufacturer']) {
      return manufacturer ? manufacturerViews.delete(manufacturer) : false
    },
    dispose() {
      lists.dispose()
      entities.dispose()
    },
  }
}

export type PartsDomain = ReturnType<typeof createPartsDomain>
