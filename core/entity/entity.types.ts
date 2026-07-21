import type { ReadonlyData, Unsubscribe } from '../data'
import type { SortDirection, SortingState } from '../services/sorting-service'

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
  readonly kind?: 'plugin'
  install(context: EntityStorePluginContext<TEntity, TId>): TApi
}

export interface EntityStoreIdentityPlugin<TEntity, TId> {
  readonly kind: 'identity'
  readonly getId: (entity: TEntity) => TId
}

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
  readonly visibleIds: ReadonlyData<readonly TId[]>
  getId(entity: TEntity): TId
  setMembership(ids: readonly TId[]): void
  setMembershipSource(source: () => readonly TId[]): void
  addTransform(transform: EntityListTransform<TEntity>): void
  watch<T>(state: ReadonlyData<T>): void
  onDispose(callback: () => void): void
}

export interface EntityListPlugin<
  TEntity,
  TId,
  TApi extends object = object,
  TMembership extends boolean = false,
> {
  readonly membership: TMembership
  install(context: EntityListPluginContext<TEntity, TId>): TApi
}

export interface EntityListsPluginContext<TEntity, TId> {
  readonly store: EntityStoreCore<TEntity, TId>
  onDispose(callback: () => void): void
}

export interface EntityListsPlugin<TEntity, TId, TApi extends object = object> {
  install(context: EntityListsPluginContext<TEntity, TId>): TApi
}

export interface EntityListsCore<TEntity, TId> {
  readonly store: EntityStoreCore<TEntity, TId>
  readonly keys: ReadonlyData<readonly string[]>
  readonly items: ReadonlyData<readonly EntityList<TEntity, TId, object>[]>
  create<TArgs = void>(name: string): import('./entity-list').EntityListBuilder<TEntity, TId, TArgs>
  get(name: string): EntityList<TEntity, TId, object> | undefined
  delete(name: string): boolean
  dispose(): void
}

export type EntityLists<TEntity, TId, TApi extends object = object> = EntityListsCore<TEntity, TId> & TApi & {
  use<TAdded extends object>(
    plugin: EntityListsPlugin<TEntity, TId, TAdded>
      & NoPluginKeyOverlap<EntityListsCore<TEntity, TId> & TApi, TAdded>,
  ): EntityLists<TEntity, TId, TApi & TAdded>
}

export interface ManualApi<TEntity, TId> {
  readonly manual: {
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

export interface SingleSelectionApi<TEntity, TId> {
  readonly selection: {
    readonly mode: 'single'
    readonly id: ReadonlyData<TId | null>
    readonly item: ReadonlyData<TEntity | undefined>
    select(id: TId): void
    selectFirst(): void
    clear(): void
    keepVisible(): void
    isSelected(id: TId): boolean
  }
}

export interface MultipleSelectionApi<TEntity, TId> {
  readonly selection: {
    readonly mode: 'multiple'
    readonly ids: ReadonlyData<readonly TId[]>
    readonly items: ReadonlyData<readonly TEntity[]>
    select(id: TId): void
    deselect(id: TId): void
    toggle(id: TId): void
    selectAll(): void
    selectFirst(): void
    clear(): void
    keepVisible(): void
    isSelected(id: TId): boolean
  }
}

export type SelectionApi<TEntity, TId, TMode extends 'single' | 'multiple'> = TMode extends 'single'
  ? SingleSelectionApi<TEntity, TId>
  : MultipleSelectionApi<TEntity, TId>

export type QueryCommand<TInput, TEntity> = [TInput] extends [void]
  ? () => Promise<readonly TEntity[]>
  : (input: TInput) => Promise<readonly TEntity[]>

export type QueryApi<TEntity, TInput, TServices extends object> = {
  readonly query: TServices & {
    readonly replace: QueryCommand<TInput, TEntity>
    readonly append: QueryCommand<TInput, TEntity>
  }
}

export interface CopiesCollection<TArgs, TCopy> {
  readonly keys: ReadonlyData<readonly string[]>
  readonly items: ReadonlyData<readonly TCopy[]>
  create(key: string, args: TArgs): TCopy
  get(key: string): TCopy | undefined
  delete(key: string): boolean
  clear(): void
}

export interface CopiesApi<TArgs, TCopy> {
  readonly copies: CopiesCollection<TArgs, TCopy>
}
