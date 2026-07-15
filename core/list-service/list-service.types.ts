import type { EntityListContract, RuntimeKey } from '../mapped-list/mapped-list.types'
import type { LoadingStatus } from '../services/LoadingService'
import type { PaginationState } from '../services/PaginationService'
import type { SortingState } from '../services/sorting/sorting-service.types'

export interface ListServiceOptions<TEntity, TId extends string = string> {
	name: string
	getId(entity: TEntity): TId
}

export interface ListService<TEntity, TId extends string = string> {
	get(id: TId): TEntity | undefined
	has(id: TId): boolean
	values(): readonly TEntity[]
	update(entity: TEntity): void
	updateMany(entities: readonly TEntity[]): void
	delete(id: TId): void

	list(key?: RuntimeKey): EntityListContract<TEntity, TId>
	listKeys(): readonly string[]

	loadList(key?: RuntimeKey): Promise<readonly TEntity[]>
	loadNextPage(key?: RuntimeKey): Promise<readonly TEntity[]>

	getById(id: TId, key?: RuntimeKey): Promise<TEntity>
	getByIds(ids: readonly TId[], key?: RuntimeKey): Promise<readonly TEntity[]>

	sorting(key?: RuntimeKey): SortingState<string>
	setSorting(value: SortingState<string>, key?: RuntimeKey): void

	filters(key?: RuntimeKey): Record<string, unknown>
	setFilters(value: Record<string, unknown>, key?: RuntimeKey): void

	pagination(key?: RuntimeKey): PaginationState
	setPage(page: number, key?: RuntimeKey): void
	setPageSize(pageSize: number, key?: RuntimeKey): void

	loading(key?: RuntimeKey): LoadingStatus
}
