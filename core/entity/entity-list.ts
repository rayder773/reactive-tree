import { data, readonlyData, type Data, type ReadonlyData, type Unsubscribe } from '../data'
import { SelectionService, type SortingState } from '../services'
import type { QuerySourcePlugin } from './entity-query'
import {
  ENTITY_STORE_INTERNAL,
  type CopiesApi,
  type EntityList,
  type EntityListCore,
  type EntityListPlugin,
  type EntityListPluginContext,
  type EntityStoreCore,
  type FilteringApi,
  type ManualApi,
  type NoPluginKeyOverlap,
  type QueryApi,
  type SelectionApi,
  type SortingApi,
} from './entity.types'

type EmptyApi = Record<never, never>

export interface UniversalEntityListPlugin<TEntity, TApi extends object, TMembership extends boolean = false> {
  readonly membership: TMembership
  install<TId>(context: EntityListPluginContext<TEntity, TId>): TApi
}

export interface AllEntitiesPlugin {
  readonly kind: 'all-entities'
  readonly membership: true
}

export interface ManualPlugin {
  readonly kind: 'manual'
  readonly membership: true
}

export interface SelectionPlugin<TMode extends 'single' | 'multiple'> {
  readonly kind: 'item-selection'
  readonly membership: false
  readonly mode: TMode
}

export interface CopiesPlugin {
  readonly kind: 'copies'
  readonly membership: false
}

type RuntimePlugin<TEntity, TId> = EntityListPlugin<TEntity, TId, object, boolean>
type PluginRecipe<TEntity, TId, TArgs> = RuntimePlugin<TEntity, TId> | ((args: TArgs) => RuntimePlugin<TEntity, TId>)

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
  readonly #transforms: Array<(items: readonly TEntity[]) => readonly TEntity[]> = []
  readonly #unsubscribes: Unsubscribe[] = []
  readonly #disposeCallbacks: Array<() => void> = []
  #membershipSource?: () => readonly TId[]
  #disposed = false

  constructor(
    readonly id: string,
    readonly store: EntityStoreCore<TEntity, TId>,
    plugins: readonly RuntimePlugin<TEntity, TId>[],
  ) {
    const internal = store[ENTITY_STORE_INTERNAL]
    const context: EntityListPluginContext<TEntity, TId> = {
      store,
      membership: readonlyData(this.#membership),
      visibleIds: readonlyData(this.#ids),
      getId: (entity) => internal.getId(entity),
      setMembership: (ids) => this.#membership.set([...ids]),
      setMembershipSource: (source) => {
        if (this.#membershipSource) throw new Error(`Entity list "${id}" has conflicting membership plugins`)
        this.#membershipSource = source
      },
      addTransform: (transform) => this.#transforms.push(transform),
      watch: (state) => { this.#unsubscribes.push(state.subscribe(() => this.#recompute())) },
      onDispose: (callback) => this.#disposeCallbacks.push(callback),
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
    let result: TEntity[] = []
    for (const id of this.#membershipSource?.() ?? []) {
      if (entities.has(id)) result.push(entities.get(id) as TEntity)
    }
    for (const transform of this.#transforms) result = [...transform(result)]
    this.#items.set(result)
    this.#ids.set(result.map((entity) => this.store[ENTITY_STORE_INTERNAL].getId(entity)))
  }
}

type BuildArgs<TArgs> = [TArgs] extends [void] ? [] : [args: TArgs]

export class EntityListBuilder<
  TEntity,
  TId,
  TArgs = void,
  TApi extends object = EmptyApi,
  THasMembership extends boolean = false,
  THasCopies extends boolean = false,
> {
  readonly #recipes: readonly PluginRecipe<TEntity, TId, TArgs>[]
  readonly #hasCopies: boolean
  #built = false

  constructor(
    readonly id: string,
    readonly store: EntityStoreCore<TEntity, TId>,
    recipes: readonly PluginRecipe<TEntity, TId, TArgs>[] = [],
    hasCopies = false,
    readonly onBuild?: (list: EntityList<TEntity, TId, object>) => void,
    readonly beforeBuild?: () => void,
  ) {
    this.#recipes = recipes
    this.#hasCopies = hasCopies
  }

  use(
    plugin: AllEntitiesPlugin & (THasMembership extends true ? { readonly __membershipAlreadyInstalled: never } : unknown),
  ): EntityListBuilder<TEntity, TId, TArgs, TApi, true, THasCopies>
  use(
    plugin: ManualPlugin & (THasMembership extends true ? { readonly __membershipAlreadyInstalled: never } : unknown),
  ): EntityListBuilder<TEntity, TId, TArgs, TApi & ManualApi<TEntity, TId>, true, THasCopies>
  use<TInput, TServices extends object>(
    plugin: QuerySourcePlugin<TEntity, TInput, TServices>
      & NoPluginKeyOverlap<EntityListCore<TEntity, TId> & TApi, QueryApi<TEntity, TInput, TServices>>
      & (THasMembership extends true ? { readonly __membershipAlreadyInstalled: never } : unknown),
  ): EntityListBuilder<TEntity, TId, TArgs, TApi & QueryApi<TEntity, TInput, TServices>, true, THasCopies>
  use<TMode extends 'single' | 'multiple'>(
    plugin: SelectionPlugin<TMode>
      & NoPluginKeyOverlap<EntityListCore<TEntity, TId> & TApi, SelectionApi<TEntity, TId, TMode>>,
  ): EntityListBuilder<TEntity, TId, TArgs, TApi & SelectionApi<TEntity, TId, TMode>, THasMembership, THasCopies>
  use(
    plugin: CopiesPlugin & (THasCopies extends true ? { readonly __copiesAlreadyInstalled: never } : unknown),
  ): EntityListBuilder<TEntity, TId, TArgs, TApi, THasMembership, true>
  use<TAdded extends object, TMembership extends boolean>(
    plugin: (EntityListPlugin<TEntity, TId, TAdded, TMembership> | UniversalEntityListPlugin<TEntity, TAdded, TMembership>)
      & NoPluginKeyOverlap<EntityListCore<TEntity, TId> & TApi, TAdded>
      & (TMembership extends true
        ? THasMembership extends true ? { readonly __membershipAlreadyInstalled: never } : unknown
        : unknown),
  ): EntityListBuilder<TEntity, TId, TArgs, TApi & TAdded, TMembership extends true ? true : THasMembership, THasCopies>
  use<TInput, TServices extends object>(
    factory: (args: TArgs) => QuerySourcePlugin<TEntity, TInput, TServices>,
  ): EntityListBuilder<TEntity, TId, TArgs, TApi & QueryApi<TEntity, TInput, TServices>, true, THasCopies>
  use<TAdded extends object, TMembership extends boolean>(
    factory: (args: TArgs) => EntityListPlugin<TEntity, TId, TAdded, TMembership> | UniversalEntityListPlugin<TEntity, TAdded, TMembership>,
  ): EntityListBuilder<TEntity, TId, TArgs, TApi & TAdded, TMembership extends true ? true : THasMembership, THasCopies>
  use(plugin: object): EntityListBuilder<TEntity, TId, TArgs, object, boolean, boolean> {
    this.#assertNotBuilt()
    if ('kind' in plugin && plugin.kind === 'copies') {
      return new EntityListBuilder(this.id, this.store, this.#recipes, true, this.onBuild, this.beforeBuild)
    }
    const recipe = this.#normalizeRecipe(plugin)
    return new EntityListBuilder(this.id, this.store, [...this.#recipes, recipe], this.#hasCopies, this.onBuild, this.beforeBuild)
  }

  build(
    this: EntityListBuilder<TEntity, TId, TArgs, TApi, true, THasCopies>,
    ...buildArgs: BuildArgs<TArgs>
  ): EntityList<TEntity, TId, TApi & (THasCopies extends true ? CopiesApi<TArgs, EntityList<TEntity, TId, TApi>> : EmptyApi)> {
    this.#assertNotBuilt()
    this.#built = true
    this.beforeBuild?.()
    const args = buildArgs[0] as TArgs
    const copies = new Map<string, EntityList<TEntity, TId, TApi>>()
    let copiesDisposed = false
    const copyKeys = data<readonly string[]>([])
    const copyItems = data<readonly EntityList<TEntity, TId, TApi>[]>([])
    const publishCopies = () => {
      copyKeys.set([...copies.keys()])
      copyItems.set([...copies.values()])
    }
    const clearCopies = () => {
      for (const list of copies.values()) list.dispose()
      copies.clear()
      publishCopies()
    }
    const disposeCopies = () => { copiesDisposed = true; clearCopies() }
    const root = this.#instantiate(this.id, args, this.#hasCopies ? disposeCopies : undefined) as EntityList<TEntity, TId, TApi>

    if (this.#hasCopies) {
      const copiesApi: CopiesApi<TArgs, EntityList<TEntity, TId, TApi>> = {
        copies: {
          keys: readonlyData(copyKeys),
          items: readonlyData(copyItems),
          create: (key, copyArgs) => {
            if (copiesDisposed) throw new Error(`Entity list copies for "${this.id}" have been disposed`)
            if (copies.has(key)) throw new Error(`Entity list copies already contain key "${key}"`)
            const copy = this.#instantiate(`${this.id}:${key}`, copyArgs) as EntityList<TEntity, TId, TApi>
            copies.set(key, copy)
            publishCopies()
            return copy
          },
          get: (key) => copies.get(key),
          delete: (key) => {
            const copy = copies.get(key)
            if (!copy) return false
            copy.dispose()
            copies.delete(key)
            publishCopies()
            return true
          },
          clear: clearCopies,
        },
      }
      mergeApi(root, copiesApi)
    }
    this.onBuild?.(root)
    return root as EntityList<TEntity, TId, TApi & (THasCopies extends true ? CopiesApi<TArgs, EntityList<TEntity, TId, TApi>> : EmptyApi)>
  }

  #instantiate(id: string, args: TArgs, onDispose?: () => void): EntityList<TEntity, TId, object> {
    const plugins = this.#recipes.map((recipe) => typeof recipe === 'function' ? recipe(args) : recipe)
    if (plugins.filter((plugin) => plugin.membership).length !== 1) {
      throw new Error(`Entity list "${id}" requires exactly one membership plugin`)
    }
    if (onDispose) {
      plugins.push({ membership: false, install: (context) => { context.onDispose(onDispose); return {} } })
    }
    return new EntityListImpl(id, this.store, plugins)
  }

  #normalizeRecipe(plugin: object): PluginRecipe<TEntity, TId, TArgs> {
    if (typeof plugin === 'function') {
      return plugin as unknown as (args: TArgs) => RuntimePlugin<TEntity, TId>
    }
    if ('kind' in plugin) {
      if (plugin.kind === 'all-entities') return allEntitiesRuntime<TEntity, TId>()
      if (plugin.kind === 'manual') return manualRuntime<TEntity, TId>()
      if (plugin.kind === 'item-selection') {
        return selectionRuntime<TEntity, TId>((plugin as SelectionPlugin<'single' | 'multiple'>).mode)
      }
      if (plugin.kind === 'query-source') return plugin as unknown as RuntimePlugin<TEntity, TId>
    }
    return plugin as RuntimePlugin<TEntity, TId>
  }

  #assertNotBuilt(): void {
    if (this.#built) throw new Error('Plugins cannot be installed after build()')
  }
}

const allEntitiesRuntime = <TEntity, TId>(): RuntimePlugin<TEntity, TId> => ({
  membership: true,
  install(context) {
    context.setMembershipSource(() => [...context.store.entities.get().keys()])
    return {}
  },
})

const manualRuntime = <TEntity, TId>(): EntityListPlugin<TEntity, TId, ManualApi<TEntity, TId>, true> => ({
  membership: true,
  install(context) {
    const contains = (id: TId) => context.membership.get().some((value) => Object.is(value, id))
    const appendIds = (ids: readonly TId[]) => {
      const current = context.membership.get()
      context.setMembership([...current, ...unique(ids).filter((id) => !contains(id))])
    }
    const prependIds = (ids: readonly TId[]) => {
      const current = context.membership.get()
      context.setMembership([...unique(ids).filter((id) => !contains(id)), ...current])
    }
    context.setMembershipSource(() => context.membership.get())
    context.onDispose(context.store[ENTITY_STORE_INTERNAL].onDelete((id) => {
      context.setMembership(context.membership.get().filter((value) => !Object.is(value, id)))
    }))
    context.onDispose(context.store[ENTITY_STORE_INTERNAL].onClear(() => context.setMembership([])))
    return {
      manual: {
        replace(entities) { context.store.upsertMany(entities); context.setMembership(unique(entities.map(context.getId))) },
        append(entities) { context.store.upsertMany(entities); appendIds(entities.map(context.getId)) },
        prepend(entities) { context.store.upsertMany(entities); prependIds(entities.map(context.getId)) },
        replaceIds(ids) { context.setMembership(unique(ids)) },
        appendIds,
        prependIds,
        update(entities) { context.store.upsertMany(entities.filter((entity) => contains(context.getId(entity)))) },
        remove(id) { context.setMembership(context.membership.get().filter((value) => !Object.is(value, id))) },
        clear() { context.setMembership([]) },
      },
    }
  },
})

const selectionRuntime = <TEntity, TId>(
  mode: 'single' | 'multiple',
): EntityListPlugin<TEntity, TId, object, false> => ({
  membership: false,
  install(context) {
    const service = new SelectionService<TId, 'single' | 'multiple'>(mode)
    const selectedItems = data<readonly TEntity[]>([])
    const selectedId = data<TId | null>(null)
    const selectedItem = data<TEntity | undefined>(undefined)
    const updateViews = () => {
      const entities = context.store.entities.get()
      const items = service.ids.get().flatMap((id) => {
        const entity = entities.get(id)
        return entity === undefined ? [] : [entity]
      })
      selectedItems.set(items)
      selectedId.set(service.ids.get()[0] ?? null)
      selectedItem.set(items[0])
    }
    context.onDispose(service.ids.subscribe(updateViews))
    context.onDispose(context.store.entities.subscribe(updateViews))
    context.onDispose(context.store[ENTITY_STORE_INTERNAL].onDelete((id) => service.deselect(id)))
    context.onDispose(context.store[ENTITY_STORE_INTERNAL].onClear(() => service.clear()))
    updateViews()
    const keepVisible = () => {
      const visible = context.visibleIds.get()
      service.replace(service.ids.get().filter((id) => visible.some((value) => Object.is(value, id))))
    }
    const selectFirst = () => {
      const first = context.visibleIds.get()[0]
      if (first === undefined) service.clear()
      else service.select(first)
    }
    const common = {
      select: (id: TId) => service.select(id),
      selectFirst,
      clear: () => service.clear(),
      keepVisible,
      isSelected: (id: TId) => service.isSelected(id),
    }
    if (mode === 'single') {
      return { selection: { mode, id: readonlyData(selectedId), item: readonlyData(selectedItem), ...common } }
    }
    return {
      selection: {
        mode,
        ids: service.ids,
        items: readonlyData(selectedItems),
        ...common,
        deselect: (id: TId) => service.deselect(id),
        toggle: (id: TId) => service.toggle(id),
        selectAll: () => service.replace(context.visibleIds.get()),
      },
    }
  },
})

export const allEntities = (): AllEntitiesPlugin => ({ kind: 'all-entities', membership: true })
export const manual = (): ManualPlugin => ({ kind: 'manual', membership: true })
export const selection = <TMode extends 'single' | 'multiple'>(options: { mode: TMode }): SelectionPlugin<TMode> => ({
  kind: 'item-selection',
  membership: false,
  mode: options.mode,
})
export const copies = (): CopiesPlugin => ({ kind: 'copies', membership: false })

export interface SortingOptions<TEntity, TField> {
  initial: SortingState<TField>
  compare(left: TEntity, right: TEntity, field: TField): number
}

export const sorting = <TEntity, TField>(
  options: SortingOptions<TEntity, TField>,
): UniversalEntityListPlugin<TEntity, SortingApi<TField>> => ({
  membership: false,
  install(context) {
    const initial = { ...options.initial }
    const state = data<SortingState<TField>>({ ...initial })
    context.watch(state)
    context.addTransform((items) => {
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
): UniversalEntityListPlugin<TEntity, FilteringApi<TFilters>> => ({
  membership: false,
  install(context) {
    const initial = { ...options.initial }
    const state = data<TFilters>({ ...initial })
    context.watch(state)
    context.addTransform((items) => items.filter((entity) => options.predicate(entity, state.get())))
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
