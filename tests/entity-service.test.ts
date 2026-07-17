import {
  EntityConfigurationError,
  EntityNotFoundError,
  EntityService,
  FilteringService,
  LoadingService,
  PaginationService,
  SortingService,
} from '../core'

interface Row { id: number; name: string; group: string; score: number }
type Field = 'name' | 'score'
interface Filters { group: string | null }

const row = (id: number, group = 'a'): Row => ({ id, name: `row-${id}`, group, score: id })

describe('EntityService', () => {
  it('normalizes CRUD and updates map references', () => {
    const service = new EntityService<Row, number>({ getId: (item) => item.id })
    const initial = service.entities.get()
    service.upsertMany([row(1), row(2)])
    expect(service.entities.get()).not.toBe(initial)
    expect(service.values()).toHaveLength(2)
    service.update(1, (item) => ({ ...item, name: 'updated' }))
    expect(service.get(1)?.name).toBe('updated')
    expect(service.delete(2)).toBe(true)
    service.clear()
    expect(service.values()).toEqual([])
  })

  it('uses separate cache-first id and batch callbacks', async () => {
    const idCalls: number[] = []
    const batchCalls: number[][] = []
    const service = new EntityService<Row, number>({
      getId: (item) => item.id,
      queryById: async (id) => { idCalls.push(id); return row(id) },
      queryByIds: async (ids) => { batchCalls.push([...ids]); return ids.filter((id) => id !== 3).map((id) => row(id)) },
    })
    service.upsert(row(1))
    await service.getById(2)
    const result = await service.getByIds([1, 2, 3, 3, 4])
    expect(idCalls).toEqual([2])
    expect(batchCalls).toEqual([[3, 4]])
    expect(result.map((item) => item.id)).toEqual([1, 2, 4])
  })

  it('reports configuration and not-found errors', async () => {
    const missingQuery = new EntityService<Row, number>({ getId: (item) => item.id })
    await expect(missingQuery.getById(1)).rejects.toBeInstanceOf(EntityConfigurationError)
    const wrongEntity = new EntityService<Row, number>({ getId: (item) => item.id, queryById: async () => row(2) })
    await expect(wrongEntity.getById(1)).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('tracks loading and rejects stale entity responses without overwriting the cache', async () => {
    const loading = new LoadingService<number>()
    const resolvers: Array<(value: Row) => void> = []
    const service = new EntityService<Row, number>({
      getId: (item) => item.id,
      loading: () => loading,
      queryById: () => new Promise<Row>((resolve) => resolvers.push(resolve)),
    })
    const first = service.getById(1)
    const second = service.getById(1)
    expect(loading.state(1).get().status).toBe('loading')
    resolvers[1]({ ...row(1), name: 'new' })
    await expect(second).resolves.toMatchObject({ name: 'new' })
    resolvers[0]({ ...row(1), name: 'old' })
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(service.get(1)?.name).toBe('new')
    expect(loading.state(1).get().status).toBe('idle')
  })

  it('keeps entity and query memberships synchronized with shared entity references', async () => {
    const service = new EntityService<Row, number, Field, Filters>({
      getId: (item) => item.id,
      lists: { source: 'entities', query: false },
    })
    service.upsertMany([row(1), row(2, 'b'), row(3)])
    const all = service.createList('all')
    const queried = service.createList('queried', {
      source: 'query',
      query: async () => ({ items: [row(2, 'b'), row(3)] }),
    })
    await queried.load()
    service.update(2, (item) => ({ ...item, name: 'shared' }))
    expect(all.items.get().find((item) => item.id === 2)?.name).toBe('shared')
    expect(queried.items.get()[0].name).toBe('shared')
    service.delete(2)
    expect(queried.ids.get()).toEqual([3])
  })

  it('runs client filtering, sorting and pagination in order with isolated factories', () => {
    const service = new EntityService<Row, number, Field, Filters>({
      getId: (item) => item.id,
      lists: {
        source: 'entities',
        sorting: { mode: 'client', factory: () => new SortingService<Field>({ field: 'score', direction: 'desc' }), comparator: (a, b) => a.score - b.score },
        filtering: { mode: 'client', factory: () => new FilteringService<Filters>({ group: 'a' }), predicate: (item, filters) => !filters.group || item.group === filters.group },
        pagination: { mode: 'client', factory: () => new PaginationService({ pageSize: 2 }) },
      },
    })
    service.upsertMany([row(1), row(2, 'b'), row(3), row(4)])
    const first = service.createList('first')
    const second = service.createList('second')
    expect(first.ids.get()).toEqual([4, 3])
    expect(first.pagination?.get().total).toBe(3)
    first.patchFilters({ group: null })
    expect(first.pagination?.get().total).toBe(4)
    expect(second.filters?.get().group).toBe('a')
  })

  it('sends only server capabilities and requires server totals', async () => {
    const params: unknown[] = []
    const service = new EntityService<Row, number, Field, Filters>({ getId: (item) => item.id })
    const list = service.createList('server', {
      source: 'query',
      query: async (value) => { params.push(value); return { items: [row(1)], total: 9 } },
      sorting: { mode: 'server', factory: () => new SortingService<Field>({ field: 'name', direction: 'asc' }) },
      filtering: { mode: 'client', factory: () => new FilteringService<Filters>({ group: null }), predicate: () => true },
      pagination: { mode: 'server', factory: () => new PaginationService({ page: 2, pageSize: 4 }) },
    })
    await list.load()
    expect(params).toEqual([{ sorting: { field: 'name', direction: 'asc' }, pagination: { page: 1, pageSize: 4, offset: 0, limit: 4 } }])
    expect(list.pagination?.get().total).toBe(9)
  })
})
