import type { ReadonlyData } from '../../data'
import { FilteringService } from '../filtering-service'
import { LoadingService, type LoadingState } from '../loading-service'
import { PaginationService, type PaginationState } from '../pagination-service'
import { SortingService, type SortingState } from '../sorting-service'
import type { UniversalQueryPlugin } from './query.types'

export interface QueryLoadingApi {
	readonly loading: {
		readonly state: ReadonlyData<LoadingState>
		readonly activeCount: ReadonlyData<number>
		reset(): void
	}
}

export const queryLoading = (): UniversalQueryPlugin<QueryLoadingApi> => ({
	install(context) {
		const service = new LoadingService<'query'>()
		context.interceptRequest((next) => (input, signal) =>
			service.run('query', () => next(input, signal), signal),
		)
		context.onDispose(() => service.dispose())
		return {
			loading: {
				state: service.state('query'),
				activeCount: service.activeCount('query'),
				reset: () => service.reset('query'),
			},
		}
	},
})

export interface QuerySortingApi<TField> {
	readonly sorting: SortingService<TField>
}

export const querySorting = <TField>(
	initial: SortingState<TField>,
): UniversalQueryPlugin<QuerySortingApi<TField>> => ({
	install: () => ({ sorting: new SortingService(initial) }),
})

export interface QueryFilteringApi<TFilters extends object> {
	readonly filtering: FilteringService<TFilters>
}

export const queryFiltering = <TFilters extends object>(
	initial: TFilters,
): UniversalQueryPlugin<QueryFilteringApi<TFilters>> => ({
	install: () => ({ filtering: new FilteringService(initial) }),
})

export interface QueryPaginationApi {
	readonly pagination: PaginationService
}

export const queryPagination = (
	initial: Partial<PaginationState> = {},
): UniversalQueryPlugin<QueryPaginationApi> => ({
	install: () => ({ pagination: new PaginationService(initial) }),
})
