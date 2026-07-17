import { data, defaultDataAdapter, readonlyData, type Data, type DataAdapter, type ReadonlyData } from '../data'
import type { AbortService, LoadingService } from '../services'
import { EntityList } from './entity-list'
import type { EntityListOptions, EntityListOverrides, EntityServiceOptions } from './entity.types'

export class EntityNotFoundError<TId = unknown> extends Error {
  constructor(readonly id: TId) {
    super(`Entity ${String(id)} was not returned by the configured query`)
    this.name = 'EntityNotFoundError'
  }
}

export class EntityConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntityConfigurationError'
  }
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]
const batchRequestKey = Symbol('entity:batch')

export class EntityService<TEntity, TId, TField = never, TFilters extends object = Record<string, never>> {
  readonly #options: EntityServiceOptions<TEntity, TId, TField, TFilters>
  readonly #dataAdapter: DataAdapter
  readonly #entities: Data<ReadonlyMap<TId, TEntity>>
  readonly entities: ReadonlyData<ReadonlyMap<TId, TEntity>>
  readonly #listKeys: Data<readonly string[]>
  readonly listKeys: ReadonlyData<readonly string[]>
  readonly #lists = new Map<string, EntityList<TEntity, TId, TField, TFilters>>()
  readonly #loading?: LoadingService<TId>
  readonly #abort?: AbortService<unknown>
  readonly #requestGenerations = new Map<unknown, number>()
  #disposed = false

  constructor(options: EntityServiceOptions<TEntity, TId, TField, TFilters>) {
    this.#options = options
    this.#dataAdapter = options.dataAdapter ?? defaultDataAdapter
    this.#entities = data<ReadonlyMap<TId, TEntity>>(new Map(), this.#dataAdapter)
    this.entities = readonlyData(this.#entities)
    this.#listKeys = data<readonly string[]>([], this.#dataAdapter)
    this.listKeys = readonlyData(this.#listKeys)
    this.#loading = options.loading ? options.loading(this.#dataAdapter) : undefined
    this.#abort = options.abort ? options.abort() : undefined
  }

  get(id: TId): TEntity | undefined { return this.#entities.get().get(id) }
  has(id: TId): boolean { return this.#entities.get().has(id) }
  values(): readonly TEntity[] { return [...this.#entities.get().values()] }

  upsert(entity: TEntity): TEntity {
    this.#assertActive()
    const id = this.#options.getId(entity)
    const next = new Map(this.#entities.get())
    next.set(id, entity)
    this.#entities.set(next)
    return entity
  }

  upsertMany(entities: readonly TEntity[]): readonly TEntity[] {
    this.#assertActive()
    if (entities.length === 0) return entities
    const next = new Map(this.#entities.get())
    for (const entity of entities) next.set(this.#options.getId(entity), entity)
    this.#entities.set(next)
    return entities
  }

  update(id: TId, updater: (entity: TEntity) => TEntity): TEntity | undefined {
    const current = this.get(id)
    if (current === undefined) return undefined
    const next = updater(current)
    const nextId = this.#options.getId(next)
    if (!Object.is(id, nextId)) throw new Error('Entity update cannot change its id')
    return this.upsert(next)
  }

  delete(id: TId): boolean {
    this.#assertActive()
    if (!this.has(id)) return false
    const next = new Map(this.#entities.get())
    next.delete(id)
    this.#entities.set(next)
    for (const list of this.#lists.values()) list.handleEntityDeleted(id)
    return true
  }

  clear(): void {
    this.#assertActive()
    if (this.#entities.get().size === 0) return
    this.#entities.set(new Map())
    for (const list of this.#lists.values()) list.handleEntitiesCleared()
  }

  async getById(id: TId): Promise<TEntity> {
    this.#assertActive()
    const cached = this.get(id)
    if (cached !== undefined) return cached
    if (!this.#options.queryById) throw new EntityConfigurationError('queryById is not configured')
    const operation = async (signal: AbortSignal) => {
      const entity = await this.#options.queryById?.(id, signal)
      if (!entity || !Object.is(this.#options.getId(entity), id)) throw new EntityNotFoundError(id)
      return entity
    }
    const entity = await this.#runRequest(id, operation, this.#loading ? [id] : [])
    return this.upsert(entity)
  }

  async getByIds(ids: readonly TId[]): Promise<readonly TEntity[]> {
    this.#assertActive()
    const missing = unique(ids.filter((id) => !this.has(id)))
    if (missing.length > 0) {
      if (!this.#options.queryByIds) throw new EntityConfigurationError('queryByIds is not configured')
      const batchKey = batchRequestKey
      const found = await this.#runRequest(
        batchKey,
        (signal) => this.#options.queryByIds?.(missing, signal) as Promise<readonly TEntity[]>,
        missing,
      )
      this.upsertMany(found)
    }
    return ids.flatMap((id) => {
      const entity = this.get(id)
      return entity === undefined ? [] : [entity]
    })
  }

  createList(
    id: string,
    overrides: EntityListOverrides<TEntity, TField, TFilters> = {},
  ): EntityList<TEntity, TId, TField, TFilters> {
    this.#assertActive()
    if (this.#lists.has(id)) throw new Error(`Entity list "${id}" already exists`)
    const defaults = this.#options.lists
    const effective = { ...defaults, ...overrides } as EntityListOptions<TEntity, TField, TFilters>
    if (!effective.source) throw new EntityConfigurationError(`Entity list "${id}" requires a source`)
    const list = new EntityList(id, effective, {
      entities: this.entities,
      dataAdapter: this.#dataAdapter,
      getId: this.#options.getId,
      upsertMany: (items) => this.upsertMany(items),
    })
    this.#lists.set(id, list)
    this.#listKeys.set([...this.#lists.keys()])
    return list
  }

  getList(id: string): EntityList<TEntity, TId, TField, TFilters> | undefined { return this.#lists.get(id) }

  deleteList(id: string): boolean {
    const list = this.#lists.get(id)
    if (!list) return false
    list.dispose()
    this.#lists.delete(id)
    this.#listKeys.set([...this.#lists.keys()])
    return true
  }

  dispose(): void {
    if (this.#disposed) return
    for (const id of [...this.#lists.keys()]) this.deleteList(id)
    this.#abort?.dispose()
    this.#loading?.dispose()
    this.#requestGenerations.clear()
    this.#disposed = true
  }

  async #runRequest<T>(key: unknown, operation: (signal: AbortSignal) => Promise<T>, loadingKeys: readonly TId[]): Promise<T> {
    const generation = (this.#requestGenerations.get(key) ?? 0) + 1
    this.#requestGenerations.set(key, generation)
    const transport = () => this.#abort
      ? this.#abort.run(key, operation)
      : operation(new AbortController().signal)
    const request = transport()
    let result: T
    if (!this.#loading || loadingKeys.length === 0) {
      result = await request
    } else {
      const tracked = loadingKeys.map((loadingKey) => this.#loading?.run(loadingKey, () => request) as Promise<T>)
      const results = await Promise.all(tracked)
      result = results[0] as T
    }
    if (this.#requestGenerations.get(key) !== generation) throw new DOMException('Stale request', 'AbortError')
    return result
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('EntityService has been disposed')
  }
}
