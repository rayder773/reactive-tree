import { data, readonlyData, type Data } from '../data'
import {
  ENTITY_STORE_INTERNAL,
  type EntityStore,
  type EntityStoreCore,
  type EntityStoreIdentityPlugin,
  type EntityStorePlugin,
  type NoPluginKeyOverlap,
} from './entity.types'

const mergeApi = (target: object, api: object): void => {
  for (const key of Reflect.ownKeys(api)) {
    if (key in target) throw new Error(`Plugin API key "${String(key)}" already exists`)
    Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(api, key) as PropertyDescriptor)
  }
}

class EntityStoreImpl<TEntity, TId> implements EntityStoreCore<TEntity, TId> {
  readonly #getId: (entity: TEntity) => TId
  readonly #state: Data<ReadonlyMap<TId, TEntity>> = data(new Map())
  readonly entities = readonlyData(this.#state)
  readonly #deleteListeners = new Set<(id: TId) => void>()
  readonly #clearListeners = new Set<() => void>()
  readonly #disposeCallbacks: Array<() => void> = []
  #disposed = false

  constructor(getId: (entity: TEntity) => TId) { this.#getId = getId }

  get(id: TId): TEntity | undefined { return this.#state.get().get(id) }
  has(id: TId): boolean { return this.#state.get().has(id) }
  values(): readonly TEntity[] { return [...this.#state.get().values()] }

  upsert(entity: TEntity): TEntity {
    this.#assertActive()
    const next = new Map(this.#state.get())
    next.set(this.#getId(entity), entity)
    this.#state.set(next)
    return entity
  }

  upsertMany(entities: readonly TEntity[]): readonly TEntity[] {
    this.#assertActive()
    if (entities.length === 0) return entities
    const next = new Map(this.#state.get())
    for (const entity of entities) next.set(this.#getId(entity), entity)
    this.#state.set(next)
    return entities
  }

  update(id: TId, updater: (entity: TEntity) => TEntity): TEntity | undefined {
    this.#assertActive()
    const current = this.get(id)
    if (current === undefined) return undefined
    const next = updater(current)
    if (!Object.is(id, this.#getId(next))) throw new Error('Entity update cannot change its id')
    return this.upsert(next)
  }

  delete(id: TId): boolean {
    this.#assertActive()
    if (!this.#state.get().has(id)) return false
    const next = new Map(this.#state.get())
    next.delete(id)
    this.#state.set(next)
    for (const listener of [...this.#deleteListeners]) listener(id)
    return true
  }

  clear(): void {
    this.#assertActive()
    if (this.#state.get().size > 0) this.#state.set(new Map())
    for (const listener of [...this.#clearListeners]) listener()
  }

  addDisposeCallback(callback: () => void): void { this.#disposeCallbacks.push(callback) }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    for (const callback of [...this.#disposeCallbacks].reverse()) callback()
    this.#disposeCallbacks.length = 0
    this.#deleteListeners.clear()
    this.#clearListeners.clear()
  }

  readonly [ENTITY_STORE_INTERNAL] = {
    getId: (entity: TEntity) => this.#getId(entity),
    onDelete: (listener: (id: TId) => void) => {
      this.#deleteListeners.add(listener)
      return () => this.#deleteListeners.delete(listener)
    },
    onClear: (listener: () => void) => {
      this.#clearListeners.add(listener)
      return () => this.#clearListeners.delete(listener)
    },
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('EntityStore has been disposed')
  }
}

export class EntityStoreBuilder<TEntity, TId = never, TApi extends object = Record<never, never>> {
  readonly #plugins: Array<EntityStorePlugin<TEntity, TId, object>>
  readonly #identity?: (entity: TEntity) => TId
  #built = false

  constructor(
    plugins: Array<EntityStorePlugin<TEntity, TId, object>> = [],
    getId?: (entity: TEntity) => TId,
  ) {
    this.#plugins = plugins
    this.#identity = getId
  }

  use<TNextId>(
    plugin: EntityStoreIdentityPlugin<TEntity, TNextId>
      & ([TId] extends [never] ? unknown : { readonly __identityAlreadyInstalled: never }),
  ): EntityStoreBuilder<TEntity, TNextId, TApi>
  use<TAdded extends object>(
    plugin: EntityStorePlugin<TEntity, TId, TAdded> & NoPluginKeyOverlap<EntityStoreCore<TEntity, TId> & TApi, TAdded>,
  ): EntityStoreBuilder<TEntity, TId, TApi & TAdded>
  use(plugin: EntityStoreIdentityPlugin<TEntity, unknown> | EntityStorePlugin<TEntity, TId, object>): EntityStoreBuilder<TEntity, unknown, TApi> {
    this.#assertNotBuilt()
    if (plugin.kind === 'identity') {
      if (this.#identity) throw new Error('EntityStore identity plugin is already installed')
      return new EntityStoreBuilder(this.#plugins as Array<EntityStorePlugin<TEntity, unknown, object>>, plugin.getId)
    }
    return new EntityStoreBuilder([...this.#plugins, plugin] as Array<EntityStorePlugin<TEntity, unknown, object>>, this.#identity)
  }

  build(this: EntityStoreBuilder<TEntity, TId, TApi> & ([TId] extends [never] ? never : unknown)): EntityStore<TEntity, TId, TApi> {
    this.#assertNotBuilt()
    this.#built = true
    if (!this.#identity) throw new Error('EntityStore requires exactly one identity plugin')
    const store = new EntityStoreImpl(this.#identity)
    for (const plugin of this.#plugins) {
      const api = plugin.install({
        store,
        entities: store.entities,
        getId: (entity) => store[ENTITY_STORE_INTERNAL].getId(entity),
        onDispose: (callback) => store.addDisposeCallback(callback),
      })
      mergeApi(store, api)
    }
    return store as EntityStore<TEntity, TId, TApi>
  }

  #assertNotBuilt(): void {
    if (this.#built) throw new Error('Plugins cannot be installed after build()')
  }
}

export const entityStore = <TEntity>(): EntityStoreBuilder<TEntity> => new EntityStoreBuilder<TEntity>()

export const identity = <TEntity, TId>(getId: (entity: TEntity) => TId): EntityStoreIdentityPlugin<TEntity, TId> => ({
  kind: 'identity',
  getId,
})
