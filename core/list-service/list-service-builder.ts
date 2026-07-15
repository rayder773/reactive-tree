import type {
	EntityListContract,
	MappedListContract,
	RuntimeKey,
} from '../mapped-list/mapped-list.types'
import type { AppRuntime } from '../runtime/AppRuntime'
import type { AbortService } from '../services/AbortService'
import type {
	FiltersServiceContract,
	FiltersServiceOptions,
} from '../services/filters/filters-service.types'
import type { LoadingService, LoadingStatus } from '../services/LoadingService'
import type {
	PaginationService,
	PaginationState,
} from '../services/PaginationService'
import type {
	SortingServiceContract,
	SortingServiceOptions,
	SortingState,
} from '../services/sorting/sorting-service.types'
import type { ListService, ListServiceOptions } from './list-service.types'

interface BuilderConfig<TEntity, TId extends string> {
	name: string
	app: AppRuntime
	mappedList: MappedListContract<TEntity, TId>
	loadingService: LoadingService | undefined
	abortService: AbortService | undefined
	paginationService: PaginationService | undefined
	isPaginationServer: boolean
	sortingService: SortingServiceContract<string> | undefined
	isSortingServer: boolean
	filtersService: FiltersServiceContract<Record<string, unknown>> | undefined
	isFiltersServer: boolean
	queryFn: ((signal: AbortSignal) => Promise<readonly TEntity[]>) | undefined
	serverQueryFn:
		| ((
				params: Record<string, unknown>,
				signal: AbortSignal,
		  ) => Promise<unknown>)
		| undefined
	mapResponse:
		| ((response: unknown) => { items: readonly TEntity[]; total: number })
		| undefined
	byIdsFn:
		| ((
				ids: readonly TId[],
				signal: AbortSignal,
		  ) => Promise<readonly TEntity[]>)
		| undefined
}

export class ListServiceBuilder<TEntity, TId extends string = string> {
	private readonly config: BuilderConfig<TEntity, TId>

	constructor(config: BuilderConfig<TEntity, TId>) {
		this.config = config
	}

	withLoading(): this {
		return this.clone({
			loadingService: this.config.app.createLoadingService(),
		})
	}

	withAbort(): this {
		return this.clone({ abortService: this.config.app.createAbortService() })
	}

	withServerSorting<TField extends string>(
		options: SortingServiceOptions<TField>,
	): this {
		return this.clone({
			sortingService: this.config.app.createSortingService(
				options,
			) as SortingServiceContract<string>,
			isSortingServer: true,
		})
	}

	withClientSorting<TField extends string>(
		options: SortingServiceOptions<TField>,
	): this {
		return this.clone({
			sortingService: this.config.app.createSortingService(
				options,
			) as SortingServiceContract<string>,
			isSortingServer: false,
		})
	}

	withServerFilters<TFilters extends Record<string, unknown>>(
		options: FiltersServiceOptions<TFilters>,
	): this {
		return this.clone({
			filtersService: this.config.app.createFiltersService(
				options,
			) as FiltersServiceContract<Record<string, unknown>>,
			isFiltersServer: true,
		})
	}

	withClientFilters<TFilters extends Record<string, unknown>>(
		options: FiltersServiceOptions<TFilters>,
	): this {
		return this.clone({
			filtersService: this.config.app.createFiltersService(
				options,
			) as FiltersServiceContract<Record<string, unknown>>,
			isFiltersServer: false,
		})
	}

	withServerPagination(_options?: { initialPageSize?: number }): this {
		return this.clone({
			paginationService: this.config.app.createPaginationService(),
			isPaginationServer: true,
		})
	}

	withClientPagination(_options?: { initialPageSize?: number }): this {
		return this.clone({
			paginationService: this.config.app.createPaginationService(),
			isPaginationServer: false,
		})
	}

	withQuery(fn: (signal: AbortSignal) => Promise<readonly TEntity[]>): this {
		return this.clone({ queryFn: fn })
	}

	withServerQuery<TRawResponse>(
		fn: (
			params: Record<string, unknown>,
			signal: AbortSignal,
		) => Promise<TRawResponse>,
		options: {
			mapResponse: (response: TRawResponse) => {
				items: readonly TEntity[]
				total: number
			}
		},
	): this {
		return this.clone({
			serverQueryFn: fn as BuilderConfig<TEntity, TId>['serverQueryFn'],
			mapResponse: options.mapResponse as BuilderConfig<
				TEntity,
				TId
			>['mapResponse'],
		})
	}

	withByIdsQuery(
		fn: (
			ids: readonly TId[],
			signal: AbortSignal,
		) => Promise<readonly TEntity[]>,
	): this {
		return this.clone({ byIdsFn: fn })
	}

	build(): ListService<TEntity, TId> {
		return new ListServiceImpl<TEntity, TId>(this.config)
	}

	private clone(overrides: Partial<BuilderConfig<TEntity, TId>>): this {
		return new ListServiceBuilder<TEntity, TId>({
			...this.config,
			...overrides,
		}) as this
	}
}

class ListServiceImpl<TEntity, TId extends string = string>
	implements ListService<TEntity, TId>
{
	constructor(private readonly config: BuilderConfig<TEntity, TId>) {}

	get(id: TId): TEntity | undefined {
		return this.config.mappedList.get(id)
	}

	has(id: TId): boolean {
		return this.config.mappedList.has(id)
	}

	values(): readonly TEntity[] {
		return this.config.mappedList.values()
	}

	update(entity: TEntity): void {
		this.config.mappedList.set(entity)
	}

	updateMany(entities: readonly TEntity[]): void {
		this.config.mappedList.setMany(entities)
	}

	delete(id: TId): void {
		this.config.mappedList.delete(id)
	}

	list(key?: RuntimeKey): EntityListContract<TEntity, TId> {
		return this.config.mappedList.list(key)
	}

	listKeys(): readonly string[] {
		return this.config.mappedList.listKeys()
	}

	async loadList(key?: RuntimeKey): Promise<readonly TEntity[]> {
		const { paginationService } = this.config

		if (paginationService !== undefined) {
			paginationService.setPage(1, key)
		}

		return this.executeLoad(key, 'replace')
	}

	async loadNextPage(key?: RuntimeKey): Promise<readonly TEntity[]> {
		const { paginationService } = this.config

		if (paginationService !== undefined) {
			const current = paginationService.get(key)
			paginationService.setPage(current.page + 1, key)
		}

		return this.executeLoad(key, 'append')
	}

	async getById(id: TId, key?: RuntimeKey): Promise<TEntity> {
		if (this.has(id)) {
			return this.get(id) as TEntity
		}

		const results = await this.getByIds([id], key)
		const entity = results[0]

		if (entity === undefined) {
			throw new Error(`Entity not found: ${id}`)
		}

		return entity
	}

	async getByIds(
		ids: readonly TId[],
		_key?: RuntimeKey,
	): Promise<readonly TEntity[]> {
		const { byIdsFn, abortService, loadingService, name } = this.config

		if (byIdsFn === undefined) {
			throw new Error(
				'ListService: byIdsQuery is not configured. Call withByIdsQuery() in the builder.',
			)
		}

		const missingIds = ids.filter((id) => !this.has(id))

		if (missingIds.length === 0) {
			return ids
				.map((id) => this.get(id))
				.filter((e): e is TEntity => e !== undefined)
		}

		const batchKey = [name, 'batch', ...[...missingIds].sort()]

		const batchPromise: Promise<readonly TEntity[]> =
			abortService !== undefined
				? abortService.run((signal) => byIdsFn(missingIds, signal), batchKey)
				: byIdsFn(missingIds, new AbortController().signal)

		if (loadingService !== undefined) {
			await Promise.all(
				missingIds.map((id) =>
					loadingService.run(() => batchPromise, [name, 'entity', id]),
				),
			)
		} else {
			await batchPromise
		}

		const result = await batchPromise
		this.updateMany(result)

		return ids
			.map((id) => this.get(id))
			.filter((e): e is TEntity => e !== undefined)
	}

	sorting(key?: RuntimeKey): SortingState<string> {
		const { sortingService } = this.config

		if (sortingService === undefined) {
			throw new Error(
				'ListService: sorting is not configured. Call withServerSorting() or withClientSorting() in the builder.',
			)
		}

		return sortingService.get(key)
	}

	setSorting(value: SortingState<string>, key?: RuntimeKey): void {
		const { sortingService, paginationService } = this.config

		if (sortingService === undefined) {
			throw new Error(
				'ListService: sorting is not configured. Call withServerSorting() or withClientSorting() in the builder.',
			)
		}

		sortingService.set(value, key)

		if (paginationService !== undefined) {
			paginationService.setPage(1, key)
		}
	}

	filters(key?: RuntimeKey): Record<string, unknown> {
		const { filtersService } = this.config

		if (filtersService === undefined) {
			throw new Error(
				'ListService: filters is not configured. Call withServerFilters() or withClientFilters() in the builder.',
			)
		}

		return filtersService.get(key)
	}

	setFilters(value: Record<string, unknown>, key?: RuntimeKey): void {
		const { filtersService, paginationService } = this.config

		if (filtersService === undefined) {
			throw new Error(
				'ListService: filters is not configured. Call withServerFilters() or withClientFilters() in the builder.',
			)
		}

		filtersService.set(value, key)

		if (paginationService !== undefined) {
			paginationService.setPage(1, key)
		}
	}

	pagination(key?: RuntimeKey): PaginationState {
		const { paginationService } = this.config

		if (paginationService === undefined) {
			throw new Error(
				'ListService: pagination is not configured. Call withServerPagination() or withClientPagination() in the builder.',
			)
		}

		return paginationService.get(key)
	}

	setPage(page: number, key?: RuntimeKey): void {
		const { paginationService } = this.config

		if (paginationService === undefined) {
			throw new Error(
				'ListService: pagination is not configured. Call withServerPagination() or withClientPagination() in the builder.',
			)
		}

		paginationService.setPage(page, key)
	}

	setPageSize(pageSize: number, key?: RuntimeKey): void {
		const { paginationService } = this.config

		if (paginationService === undefined) {
			throw new Error(
				'ListService: pagination is not configured. Call withServerPagination() or withClientPagination() in the builder.',
			)
		}

		paginationService.setPageSize(pageSize, key)
	}

	loading(key?: RuntimeKey): LoadingStatus {
		const { loadingService } = this.config

		if (loadingService === undefined) {
			throw new Error(
				'ListService: loading is not configured. Call withLoading() in the builder.',
			)
		}

		return loadingService.get(key)
	}

	private async executeLoad(
		key: RuntimeKey | undefined,
		mode: 'replace' | 'append',
	): Promise<readonly TEntity[]> {
		const {
			queryFn,
			serverQueryFn,
			mapResponse,
			loadingService,
			abortService,
			paginationService,
			sortingService,
			filtersService,
			isSortingServer,
			isFiltersServer,
			isPaginationServer,
			mappedList,
		} = this.config

		if (queryFn === undefined && serverQueryFn === undefined) {
			throw new Error(
				'ListService: query is not configured. Call withQuery() or withServerQuery() in the builder.',
			)
		}

		const list = mappedList.list(key)

		const doRequest = async (
			signal: AbortSignal,
		): Promise<readonly TEntity[]> => {
			if (serverQueryFn !== undefined && mapResponse !== undefined) {
				const params: Record<string, unknown> = {}

				if (sortingService !== undefined && isSortingServer) {
					params.sorting = sortingService.get(key)
				}

				if (filtersService !== undefined && isFiltersServer) {
					params.filters = filtersService.get(key)
				}

				if (paginationService !== undefined && isPaginationServer) {
					const pagination = paginationService.get(key)
					params.offset = (pagination.page - 1) * pagination.pageSize
					params.limit = pagination.pageSize
				}

				const response = await serverQueryFn(params, signal)
				const { items, total } = mapResponse(response)
				const nextItems =
					mode === 'append' &&
					paginationService !== undefined &&
					isPaginationServer
						? items.slice(0, paginationService.get(key).pageSize)
						: items

				if (mode === 'append') {
					list.append(nextItems)
				} else {
					list.set(nextItems)
				}

				if (paginationService !== undefined && isPaginationServer) {
					paginationService.setTotal(total, key)
				}

				return list.get()
			}

			if (queryFn === undefined) {
				throw new Error(
					'ListService: query is not configured. Call withQuery() or withServerQuery() in the builder.',
				)
			}

			const items = await queryFn(signal)

			if (mode === 'append') {
				list.append(items)
			} else {
				list.set(items)
			}

			return list.get()
		}

		const execute = (): Promise<readonly TEntity[]> => {
			if (abortService !== undefined) {
				return abortService.run((signal) => doRequest(signal), key)
			}

			return doRequest(new AbortController().signal)
		}

		if (loadingService !== undefined) {
			return loadingService.run(() => execute(), key)
		}

		return execute()
	}
}

export function createListServiceBuilder<TEntity, TId extends string = string>(
	app: AppRuntime,
	options: ListServiceOptions<TEntity, TId>,
	mappedList: MappedListContract<TEntity, TId>,
): ListServiceBuilder<TEntity, TId> {
	return new ListServiceBuilder<TEntity, TId>({
		name: options.name,
		app,
		mappedList,
		loadingService: undefined,
		abortService: undefined,
		paginationService: undefined,
		isPaginationServer: false,
		sortingService: undefined,
		isSortingServer: false,
		filtersService: undefined,
		isFiltersServer: false,
		queryFn: undefined,
		serverQueryFn: undefined,
		mapResponse: undefined,
		byIdsFn: undefined,
	})
}
