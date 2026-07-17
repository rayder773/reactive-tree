import type { DataAdapter, ReadonlyData } from '../data'
import type {
  AbortService,
  FilteringService,
  LoadingService,
  PaginationService,
  PaginationState,
  SortingService,
  SortingState,
} from '../services'

export type ProcessingMode = 'server' | 'client'
export type ListSource = 'entities' | 'query'

export interface ListQueryParams<TField, TFilters> {
  sorting?: SortingState<TField>
  filters?: TFilters
  pagination?: Pick<PaginationState, 'page' | 'pageSize'> & { offset: number; limit: number }
}

export interface ListQueryResult<TEntity> {
  items: readonly TEntity[]
  total?: number
}

export type ListQuery<TEntity, TField, TFilters> = (
  params: ListQueryParams<TField, TFilters>,
  signal: AbortSignal,
) => Promise<ListQueryResult<TEntity>>

export interface SortingCapability<TEntity, TField> {
  mode: ProcessingMode
  factory: (dataAdapter: DataAdapter) => SortingService<TField>
  comparator?: (left: TEntity, right: TEntity, field: TField) => number
}

export interface FilteringCapability<TEntity, TFilters extends object> {
  mode: ProcessingMode
  factory: (dataAdapter: DataAdapter) => FilteringService<TFilters>
  predicate?: (entity: TEntity, filters: TFilters) => boolean
}

export interface PaginationCapability {
  mode: ProcessingMode
  factory: (dataAdapter: DataAdapter) => PaginationService
}

export interface EntityListOptions<TEntity, TField, TFilters extends object> {
  source: ListSource
  query?: ListQuery<TEntity, TField, TFilters> | false
  loading?: ((dataAdapter: DataAdapter) => LoadingService<string>) | false
  abort?: (() => AbortService<string>) | false
  sorting?: SortingCapability<TEntity, TField> | false
  filtering?: FilteringCapability<TEntity, TFilters> | false
  pagination?: PaginationCapability | false
}

export type EntityListOverrides<TEntity, TField, TFilters extends object> = Partial<
  EntityListOptions<TEntity, TField, TFilters>
>

export interface EntityServiceOptions<TEntity, TId, TField = never, TFilters extends object = Record<string, never>> {
  getId(entity: TEntity): TId
  dataAdapter?: DataAdapter
  queryById?: (id: TId, signal: AbortSignal) => Promise<TEntity | undefined>
  queryByIds?: (ids: readonly TId[], signal: AbortSignal) => Promise<readonly TEntity[]>
  loading?: ((dataAdapter: DataAdapter) => LoadingService<TId>) | false
  abort?: (() => AbortService<unknown>) | false
  lists?: EntityListOptions<TEntity, TField, TFilters>
}

export interface EntityListPublic<TEntity, TId, TField, TFilters extends object> {
  readonly ids: ReadonlyData<readonly TId[]>
  readonly items: ReadonlyData<readonly TEntity[]>
  readonly loading?: ReadonlyData<import('../services').LoadingState>
  readonly sorting?: ReadonlyData<SortingState<TField>>
  readonly filters?: ReadonlyData<TFilters>
  readonly pagination?: ReadonlyData<PaginationState>
}
