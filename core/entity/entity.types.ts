import type { Data, ReadonlyData, Unsubscribe } from '../data'

export type PluginApi = Record<PropertyKey, unknown>
export type PluginApiOf<TPlugin> = TPlugin extends { readonly __api?: infer TApi } ? TApi : never
export type NoPluginKeyOverlap<TExisting, TAdded> = Extract<keyof TExisting, keyof TAdded> extends never
  ? unknown
  : { readonly __duplicatePluginKeys: Extract<keyof TExisting, keyof TAdded> }

export const ENTITY_STORE_INTERNAL: unique symbol = Symbol('entity-store-internal')

export interface EntityStoreInternal<TEntity, TId> {
  getId(entity: TEntity): TId
  onDelete(listener: (id: TId) => void): Unsubscribe
  onClear(listener: () => void): Unsubscribe
}

export interface EntityStoreCore<TEntity, TId> {
  readonly entities: ReadonlyData<ReadonlyMap<TId, TEntity>>
  get(id: TId): TEntity | undefined
  has(id: TId): boolean
  values(): readonly TEntity[]
  upsert(entity: TEntity): TEntity
  upsertMany(entities: readonly TEntity[]): readonly TEntity[]
  update(id: TId, updater: (entity: TEntity) => TEntity): TEntity | undefined
  delete(id: TId): boolean
  clear(): void
  dispose(): void
  readonly [ENTITY_STORE_INTERNAL]: EntityStoreInternal<TEntity, TId>
}

export type EntityStore<TEntity, TId = unknown, TApi extends object = object> = EntityStoreCore<TEntity, TId> & TApi

export interface EntityStorePluginContext<TEntity, TId> {
  readonly store: EntityStoreCore<TEntity, TId>
  readonly entities: ReadonlyData<ReadonlyMap<TId, TEntity>>
  getId(entity: TEntity): TId
  onDispose(callback: () => void): void
}

export interface EntityStorePlugin<TEntity, TId, TApi extends object = object> {
  readonly __api?: TApi
  readonly kind?: 'plugin'
  install(context: EntityStorePluginContext<TEntity, TId>): TApi
}

export interface EntityStoreIdentityPlugin<TEntity, TId> {
  readonly __api?: Record<never, never>
  readonly kind: 'identity'
  readonly getId: (entity: TEntity) => TId
}

export type ListPhase = 'filtering' | 'sorting' | 'final'
export type EntityListTransform<TEntity> = (items: readonly TEntity[]) => readonly TEntity[]

export interface EntityListCore<TEntity, TId> {
  readonly id: string
  readonly ids: ReadonlyData<readonly TId[]>
  readonly items: ReadonlyData<readonly TEntity[]>
  dispose(): void
}

export type EntityList<TEntity, TId = unknown, TApi extends object = object> = EntityListCore<TEntity, TId> & TApi

export interface EntityListPluginContext<TEntity, TId> {
  readonly store: EntityStoreCore<TEntity, TId>
  readonly membership: ReadonlyData<readonly TId[]>
  getId(entity: TEntity): TId
  setMembership(ids: readonly TId[]): void
  setMembershipSource(source: () => readonly TId[]): void
  addTransform(phase: ListPhase, transform: EntityListTransform<TEntity>): void
  watch<T>(state: ReadonlyData<T>): void
  onDispose(callback: () => void): void
}

export interface EntityListPlugin<
  TEntity,
  TId,
  TApi extends object = object,
  TMembership extends boolean = false,
> {
  readonly __api?: TApi
  readonly membership: TMembership
  install(context: EntityListPluginContext<TEntity, TId>): TApi
}

export interface EntityListsCore<TEntity, TId> {
  readonly keys: ReadonlyData<readonly string[]>
  readonly items: ReadonlyData<readonly EntityList<TEntity, TId, object>[]>
  create(name: string): import('./entity-list').EntityListBuilder<TEntity, TId>
  get(name: string): EntityList<TEntity, TId, object> | undefined
  delete(name: string): boolean
  define<TArgs, TList extends EntityList<TEntity, TId, object> = EntityList<TEntity, TId, object>>(
    factory: (list: import('./entity-list').EntityListBuilder<TEntity, TId>, args: TArgs) => EntityListBuildable<TEntity, TId, TList>,
  ): EntityListDefinition<TEntity, TId, TArgs, TList>
  group<TArgs, TList extends EntityList<TEntity, TId, object>>(
    name: string,
    definition: EntityListDefinition<TEntity, TId, TArgs, TList>,
  ): EntityListGroup<TEntity, TId, TArgs, TList>
  dispose(): void
}

export type EntityLists<TEntity, TId, TApi extends object = object> = EntityListsCore<TEntity, TId> & TApi

export interface EntityListsPluginContext<TEntity, TId> {
  readonly store: EntityStoreCore<TEntity, TId>
  onDispose(callback: () => void): void
}

export interface EntityListsPlugin<TEntity, TId, TApi extends object = object> {
  readonly __api?: TApi
  install(context: EntityListsPluginContext<TEntity, TId>): TApi
}

export interface EntityListBuildable<TEntity, TId, TList extends EntityList<TEntity, TId, object>> {
  build(): TList
}

export interface EntityListDefinition<TEntity, TId, TArgs, TList extends EntityList<TEntity, TId, object>> {
  readonly factory: (
    list: import('./entity-list').EntityListBuilder<TEntity, TId>,
    args: TArgs,
  ) => EntityListBuildable<TEntity, TId, TList>
}

export interface EntityListGroup<TEntity, TId, TArgs, TList extends EntityList<TEntity, TId, object>> {
  readonly name: string
  readonly keys: ReadonlyData<readonly string[]>
  readonly items: ReadonlyData<readonly TList[]>
  create(key: string, args: TArgs): TList
  get(key: string): TList | undefined
  delete(key: string): boolean
  clear(): void
  dispose(): void
}

export interface SelectionApi<TEntity, TId> {
  readonly selection: {
    replace(entities: readonly TEntity[]): void
    append(entities: readonly TEntity[]): void
    prepend(entities: readonly TEntity[]): void
    replaceIds(ids: readonly TId[]): void
    appendIds(ids: readonly TId[]): void
    prependIds(ids: readonly TId[]): void
    update(entities: readonly TEntity[]): void
    remove(id: TId): void
    clear(): void
  }
}

export type SortDirection = 'asc' | 'desc'
export interface SortingState<TField> { field: TField; direction: SortDirection }
export interface SortingApi<TField> {
  readonly sorting: {
    readonly state: ReadonlyData<SortingState<TField>>
    set(value: SortingState<TField>): void
    setField(field: TField): void
    setDirection(direction: SortDirection): void
    reset(): void
  }
}

export interface FilteringApi<TFilters extends object> {
  readonly filtering: {
    readonly state: ReadonlyData<TFilters>
    set(value: TFilters): void
    patch(value: Partial<TFilters>): void
    reset(): void
  }
}

export interface MutableListPluginContext<TEntity, TId> extends EntityListPluginContext<TEntity, TId> {
  readonly membershipData: Data<readonly TId[]>
}
