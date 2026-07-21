import { data, readonlyData, type Data } from '../data'
import { EntityListBuilder } from './entity-list'
import type {
  EntityList,
  EntityListDefinition,
  EntityListGroup,
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

class EntityListGroupImpl<
  TEntity,
  TId,
  TArgs,
  TList extends EntityList<TEntity, TId, object>,
> implements EntityListGroup<TEntity, TId, TArgs, TList> {
  readonly #lists = new Map<string, TList>()
  readonly #keys: Data<readonly string[]> = data([])
  readonly keys = readonlyData(this.#keys)
  readonly #items: Data<readonly TList[]> = data([])
  readonly items = readonlyData(this.#items)
  #disposed = false

  constructor(
    readonly name: string,
    readonly store: EntityStoreCore<TEntity, TId>,
    readonly definition: EntityListDefinition<TEntity, TId, TArgs, TList>,
    readonly onDisposeGroup: () => void,
  ) {}

  create(key: string, args: TArgs): TList {
    this.#assertActive()
    if (this.#lists.has(key)) throw new Error(`Entity list group "${this.name}" already contains key "${key}"`)
    const builder = new EntityListBuilder<TEntity, TId>(`${this.name}:${key}`, this.store)
    const list = this.definition.factory(builder, args).build()
    this.#lists.set(key, list)
    this.#publish()
    return list
  }

  get(key: string): TList | undefined { return this.#lists.get(key) }

  delete(key: string): boolean {
    const list = this.#lists.get(key)
    if (!list) return false
    list.dispose()
    this.#lists.delete(key)
    this.#publish()
    return true
  }

  clear(): void {
    for (const key of [...this.#lists.keys()]) this.delete(key)
  }

  dispose(): void {
    if (this.#disposed) return
    this.clear()
    this.#disposed = true
    this.onDisposeGroup()
  }

  disposeFromOwner(): void {
    if (this.#disposed) return
    this.clear()
    this.#disposed = true
  }

  #publish(): void {
    this.#keys.set([...this.#lists.keys()])
    this.#items.set([...this.#lists.values()])
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error(`Entity list group "${this.name}" has been disposed`)
  }
}

class EntityListsImpl<TEntity, TId> implements EntityListsCore<TEntity, TId> {
  readonly #lists = new Map<string, EntityList<TEntity, TId, object>>()
  readonly #groups = new Map<string, { disposeFromOwner(): void }>()
  readonly #keys: Data<readonly string[]> = data([])
  readonly keys = readonlyData(this.#keys)
  readonly #items: Data<readonly EntityList<TEntity, TId, object>[]> = data([])
  readonly items = readonlyData(this.#items)
  readonly #disposeCallbacks: Array<() => void> = []
  #disposed = false

  constructor(readonly store: EntityStoreCore<TEntity, TId>) {}

  create(name: string): EntityListBuilder<TEntity, TId> {
    this.#assertActive()
    this.#assertNameAvailable(name)
    return new EntityListBuilder(name, this.store, [], (list) => {
      this.#lists.set(name, list)
      this.#publish()
    }, () => {
      this.#assertActive()
      this.#assertNameAvailable(name)
    })
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

  define<TArgs, TList extends EntityList<TEntity, TId, object> = EntityList<TEntity, TId, object>>(
    factory: (list: EntityListBuilder<TEntity, TId>, args: TArgs) => { build(): TList },
  ): EntityListDefinition<TEntity, TId, TArgs, TList> {
    this.#assertActive()
    return { factory }
  }

  group<TArgs, TList extends EntityList<TEntity, TId, object>>(
    name: string,
    definition: EntityListDefinition<TEntity, TId, TArgs, TList>,
  ): EntityListGroup<TEntity, TId, TArgs, TList> {
    this.#assertActive()
    this.#assertNameAvailable(name)
    const group = new EntityListGroupImpl(name, this.store, definition, () => this.#groups.delete(name))
    this.#groups.set(name, group)
    return group
  }

  addDisposeCallback(callback: () => void): void { this.#disposeCallbacks.push(callback) }

  dispose(): void {
    if (this.#disposed) return
    for (const name of [...this.#lists.keys()]) this.delete(name)
    for (const group of this.#groups.values()) group.disposeFromOwner()
    this.#groups.clear()
    for (const callback of [...this.#disposeCallbacks].reverse()) callback()
    this.#disposeCallbacks.length = 0
    this.#disposed = true
  }

  #assertNameAvailable(name: string): void {
    if (this.#lists.has(name) || this.#groups.has(name)) {
      throw new Error(`EntityLists already contains name "${name}"`)
    }
  }

  #publish(): void {
    this.#keys.set([...this.#lists.keys()])
    this.#items.set([...this.#lists.values()])
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('EntityLists has been disposed')
  }
}

export class EntityListsBuilder<TEntity, TId, TApi extends object = EmptyApi> {
  readonly #plugins: Array<EntityListsPlugin<TEntity, TId, object>>
  #built = false

  constructor(
    readonly store: EntityStoreCore<TEntity, TId>,
    plugins: Array<EntityListsPlugin<TEntity, TId, object>> = [],
  ) {
    this.#plugins = plugins
  }

  use<TAdded extends object>(
    plugin: EntityListsPlugin<TEntity, TId, TAdded>
      & NoPluginKeyOverlap<EntityListsCore<TEntity, TId> & TApi, TAdded>,
  ): EntityListsBuilder<TEntity, TId, TApi & TAdded> {
    this.#assertNotBuilt()
    return new EntityListsBuilder(this.store, [...this.#plugins, plugin])
  }

  build(): EntityLists<TEntity, TId, TApi> {
    this.#assertNotBuilt()
    this.#built = true
    const lists = new EntityListsImpl(this.store)
    for (const plugin of this.#plugins) {
      mergeApi(lists, plugin.install({
        store: this.store,
        onDispose: (callback) => lists.addDisposeCallback(callback),
      }))
    }
    return lists as EntityLists<TEntity, TId, TApi>
  }

  #assertNotBuilt(): void {
    if (this.#built) throw new Error('Plugins cannot be installed after build()')
  }
}

export const entityLists = <TEntity, TId>(store: EntityStoreCore<TEntity, TId>): EntityListsBuilder<TEntity, TId> => (
  new EntityListsBuilder(store)
)
