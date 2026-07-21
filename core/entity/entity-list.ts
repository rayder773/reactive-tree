import { data, readonlyData, type Data, type ReadonlyData, type Unsubscribe } from '../data'
import {
  ENTITY_STORE_INTERNAL,
  type EntityList,
  type EntityListCore,
  type EntityListPlugin,
  type EntityListTransform,
  type EntityStoreCore,
  type FilteringApi,
  type ListPhase,
  type NoPluginKeyOverlap,
  type SelectionApi,
  type SortingApi,
  type SortingState,
} from './entity.types'

type EmptyApi = Record<never, never>

export interface AllEntitiesPlugin extends EntityListPlugin<any, any, EmptyApi, true> {
  readonly source: 'all-entities'
}

export interface SelectionPlugin extends EntityListPlugin<any, any, SelectionApi<any, any>, true> {
  readonly source: 'selection'
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]

const mergeApi = (target: object, api: object): void => {
  for (const key of Reflect.ownKeys(api)) {
    if (key in target) throw new Error(`Plugin API key "${String(key)}" already exists`)
    Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(api, key) as PropertyDescriptor)
  }
}

class EntityListImpl<TEntity, TId> implements EntityListCore<TEntity, TId> {
  readonly #membership: Data<readonly TId[]> = data([])
  readonly #ids: Data<readonly TId[]> = data([])
  readonly ids = readonlyData(this.#ids)
  readonly #items: Data<readonly TEntity[]> = data([])
  readonly items = readonlyData(this.#items)
  readonly #transforms: Record<ListPhase, EntityListTransform<TEntity>[]> = {
    filtering: [],
    sorting: [],
    final: [],
  }
  readonly #unsubscribes: Unsubscribe[] = []
  readonly #disposeCallbacks: Array<() => void> = []
  #membershipSource?: () => readonly TId[]
  #disposed = false

  constructor(
    readonly id: string,
    readonly store: EntityStoreCore<TEntity, TId>,
    plugins: readonly EntityListPlugin<TEntity, TId, object, boolean>[],
  ) {
    const internal = store[ENTITY_STORE_INTERNAL]
    const context = {
      store,
      membership: readonlyData(this.#membership),
      getId: (entity: TEntity) => internal.getId(entity),
      setMembership: (ids: readonly TId[]) => this.#membership.set([...ids]),
      setMembershipSource: (source: () => readonly TId[]) => {
        if (this.#membershipSource) throw new Error(`Entity list "${id}" has conflicting membership plugins`)
        this.#membershipSource = source
      },
      addTransform: (phase: ListPhase, transform: EntityListTransform<TEntity>) => this.#transforms[phase].push(transform),
      watch: <T>(state: ReadonlyData<T>) => { this.#unsubscribes.push(state.subscribe(() => this.#recompute())) },
      onDispose: (callback: () => void) => this.#disposeCallbacks.push(callback),
    }

    for (const plugin of plugins) mergeApi(this, plugin.install(context))
    if (!this.#membershipSource) throw new Error(`Entity list "${id}" requires exactly one membership plugin`)
    this.#unsubscribes.push(store.entities.subscribe(() => this.#recompute()))
    this.#unsubscribes.push(this.#membership.subscribe(() => this.#recompute()))
    this.#recompute()
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    for (const unsubscribe of this.#unsubscribes) unsubscribe()
    for (const callback of [...this.#disposeCallbacks].reverse()) callback()
    this.#unsubscribes.length = 0
    this.#disposeCallbacks.length = 0
  }

  #recompute(): void {
    if (this.#disposed) return
    const entities = this.store.entities.get()
    const source = this.#membershipSource?.() ?? []
    let result: readonly TEntity[] = source.flatMap((id) => {
      const entity = entities.get(id)
      return entity === undefined ? [] : [entity]
    })
    for (const phase of ['filtering', 'sorting', 'final'] as const) {
      for (const transform of this.#transforms[phase]) result = transform(result)
    }
    this.#items.set(result)
    this.#ids.set(result.map((entity) => this.store[ENTITY_STORE_INTERNAL].getId(entity)))
  }
}

export class EntityListBuilder<
  TEntity,
  TId,
  TApi extends object = EmptyApi,
  THasMembership extends boolean = false,
> {
  readonly #plugins: Array<EntityListPlugin<TEntity, TId, object, boolean>>
  #built = false

  constructor(
    readonly id: string,
    readonly store: EntityStoreCore<TEntity, TId>,
    plugins: Array<EntityListPlugin<TEntity, TId, object, boolean>> = [],
    readonly onBuild?: (list: EntityList<TEntity, TId, object>) => void,
    readonly beforeBuild?: () => void,
  ) {
    this.#plugins = plugins
  }

  use(
    plugin: AllEntitiesPlugin & (THasMembership extends true ? { readonly __membershipAlreadyInstalled: never } : unknown),
  ): EntityListBuilder<TEntity, TId, TApi, true>
  use(
    plugin: SelectionPlugin
      & NoPluginKeyOverlap<EntityListCore<TEntity, TId> & TApi, SelectionApi<TEntity, TId>>
      & (THasMembership extends true ? { readonly __membershipAlreadyInstalled: never } : unknown),
  ): EntityListBuilder<TEntity, TId, TApi & SelectionApi<TEntity, TId>, true>
  use<TAdded extends object>(
    plugin: EntityListPlugin<TEntity, TId, TAdded, false>
      & NoPluginKeyOverlap<EntityListCore<TEntity, TId> & TApi, TAdded>,
  ): EntityListBuilder<TEntity, TId, TApi & TAdded, THasMembership>
  use(plugin: EntityListPlugin<TEntity, TId, object, boolean>): EntityListBuilder<TEntity, TId, TApi, boolean> {
    this.#assertNotBuilt()
    return new EntityListBuilder(this.id, this.store, [...this.#plugins, plugin], this.onBuild, this.beforeBuild)
  }

  build(
    this: EntityListBuilder<TEntity, TId, TApi, true>,
  ): EntityList<TEntity, TId, TApi> {
    this.#assertNotBuilt()
    this.#built = true
    const memberships = this.#plugins.filter((plugin) => plugin.membership).length
    if (memberships !== 1) throw new Error(`Entity list "${this.id}" requires exactly one membership plugin`)
    this.beforeBuild?.()
    const list = new EntityListImpl(this.id, this.store, this.#plugins) as EntityList<TEntity, TId, TApi>
    this.onBuild?.(list)
    return list
  }

  #assertNotBuilt(): void {
    if (this.#built) throw new Error('Plugins cannot be installed after build()')
  }
}

export const allEntities = (): AllEntitiesPlugin => ({
  membership: true,
  source: 'all-entities',
  install(context) {
    context.setMembershipSource(() => [...context.store.entities.get().keys()])
    return {}
  },
})

export const selection = (): SelectionPlugin => ({
  membership: true,
  source: 'selection',
  install(context) {
    const contains = (id: unknown) => context.membership.get().some((value) => Object.is(value, id))
    const appendIds = (ids: readonly unknown[]) => {
      const current = context.membership.get()
      context.setMembership([...current, ...unique(ids).filter((id) => !contains(id))])
    }
    const prependIds = (ids: readonly unknown[]) => {
      const current = context.membership.get()
      context.setMembership([...unique(ids).filter((id) => !contains(id)), ...current])
    }
    context.setMembershipSource(() => context.membership.get())
    const unsubscribeDelete = context.store[ENTITY_STORE_INTERNAL].onDelete((id) => {
      context.setMembership(context.membership.get().filter((value) => !Object.is(value, id)))
    })
    const unsubscribeClear = context.store[ENTITY_STORE_INTERNAL].onClear(() => context.setMembership([]))
    context.onDispose(unsubscribeDelete)
    context.onDispose(unsubscribeClear)

    return {
      selection: {
        replace(entities: readonly unknown[]) {
          context.store.upsertMany(entities)
          context.setMembership(unique(entities.map(context.getId)))
        },
        append(entities: readonly unknown[]) {
          context.store.upsertMany(entities)
          appendIds(entities.map(context.getId))
        },
        prepend(entities: readonly unknown[]) {
          context.store.upsertMany(entities)
          prependIds(entities.map(context.getId))
        },
        replaceIds(ids: readonly unknown[]) { context.setMembership(unique(ids)) },
        appendIds,
        prependIds,
        update(entities: readonly unknown[]) {
          context.store.upsertMany(entities.filter((entity) => contains(context.getId(entity))))
        },
        remove(id: unknown) {
          context.setMembership(context.membership.get().filter((value) => !Object.is(value, id)))
        },
        clear() { context.setMembership([]) },
      },
    }
  },
})

export interface SortingOptions<TEntity, TField> {
  initial: SortingState<TField>
  compare(left: TEntity, right: TEntity, field: TField): number
}

export const sorting = <TEntity, TField>(options: SortingOptions<TEntity, TField>): EntityListPlugin<TEntity, any, SortingApi<TField>> => ({
  membership: false,
  install(context) {
    const initial = { ...options.initial }
    const state = data<SortingState<TField>>({ ...initial })
    context.watch(state)
    context.addTransform('sorting', (items) => {
      const current = state.get()
      const direction = current.direction === 'asc' ? 1 : -1
      return [...items].sort((left, right) => direction * options.compare(left, right, current.field))
    })
    return {
      sorting: {
        state: readonlyData(state),
        set(value) { state.set({ ...value }) },
        setField(field) { state.update((value) => ({ ...value, field })) },
        setDirection(direction) { state.update((value) => ({ ...value, direction })) },
        reset() { state.set({ ...initial }) },
      },
    }
  },
})

export interface FilteringOptions<TEntity, TFilters extends object> {
  initial: TFilters
  predicate(entity: TEntity, filters: TFilters): boolean
}

export const filtering = <TEntity, TFilters extends object>(
  options: FilteringOptions<TEntity, TFilters>,
): EntityListPlugin<TEntity, any, FilteringApi<TFilters>> => ({
  membership: false,
  install(context) {
    const initial = { ...options.initial }
    const state = data<TFilters>({ ...initial })
    context.watch(state)
    context.addTransform('filtering', (items) => items.filter((entity) => options.predicate(entity, state.get())))
    return {
      filtering: {
        state: readonlyData(state),
        set(value) { state.set({ ...value }) },
        patch(value) { state.update((current) => ({ ...current, ...value })) },
        reset() { state.set({ ...initial }) },
      },
    }
  },
})
