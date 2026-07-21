import { data, readonlyData, type Data } from '../data'
import { EntityListBuilder } from './entity-list'
import type {
  EntityList,
  EntityLists,
  EntityListsCore,
  EntityListsPlugin,
  EntityStoreCore,
  NoPluginKeyOverlap,
} from './entity.types'

type EmptyApi = Record<never, never>

const mergeApi = (target: object, api: object): void => {
  for (const key of Reflect.ownKeys(api)) {
    if (key in target) throw new Error(`Plugin API key "${String(key)}" already exists`)
    Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(api, key) as PropertyDescriptor)
  }
}

class EntityListsImpl<TEntity, TId, TApi extends object = EmptyApi> implements EntityListsCore<TEntity, TId> {
  readonly #lists = new Map<string, EntityList<TEntity, TId, object>>()
  readonly #keys: Data<readonly string[]> = data([])
  readonly keys = readonlyData(this.#keys)
  readonly #items: Data<readonly EntityList<TEntity, TId, object>[]> = data([])
  readonly items = readonlyData(this.#items)
  readonly #disposeCallbacks: Array<() => void> = []
  #disposed = false

  constructor(readonly store: EntityStoreCore<TEntity, TId>) {}

  create<TArgs = void>(name: string): EntityListBuilder<TEntity, TId, TArgs> {
    this.#assertActive()
    this.#assertNameAvailable(name)
    return new EntityListBuilder(name, this.store, [], false, (list) => {
      this.#lists.set(name, list)
      this.#publish()
    }, () => {
      this.#assertActive()
      this.#assertNameAvailable(name)
    })
  }

  use<TAdded extends object>(
    plugin: EntityListsPlugin<TEntity, TId, TAdded> & NoPluginKeyOverlap<EntityListsCore<TEntity, TId> & TApi, TAdded>,
  ): EntityLists<TEntity, TId, TApi & TAdded> {
    this.#assertActive()
    const api = plugin.install({ store: this.store, onDispose: (callback) => this.#disposeCallbacks.push(callback) })
    mergeApi(this, api)
    return this as unknown as EntityLists<TEntity, TId, TApi & TAdded>
  }

  get(name: string): EntityList<TEntity, TId, object> | undefined { return this.#lists.get(name) }

  delete(name: string): boolean {
    const list = this.#lists.get(name)
    if (!list) return false
    list.dispose()
    this.#lists.delete(name)
    this.#publish()
    return true
  }

  dispose(): void {
    if (this.#disposed) return
    for (const name of [...this.#lists.keys()]) this.delete(name)
    for (const callback of [...this.#disposeCallbacks].reverse()) callback()
    this.#disposeCallbacks.length = 0
    this.#disposed = true
  }

  #assertNameAvailable(name: string): void {
    if (this.#lists.has(name)) throw new Error(`EntityLists already contains name "${name}"`)
  }

  #publish(): void {
    this.#keys.set([...this.#lists.keys()])
    this.#items.set([...this.#lists.values()])
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('EntityLists has been disposed')
  }
}

export const entityLists = <TEntity, TId>(store: EntityStoreCore<TEntity, TId>): EntityLists<TEntity, TId, EmptyApi> => (
  new EntityListsImpl(store) as EntityLists<TEntity, TId, EmptyApi>
)
