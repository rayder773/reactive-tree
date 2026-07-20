import {
	type Data,
	data,
	type ReadonlyData,
	readonlyData,
	type Unsubscribe,
} from '../data'
import type {
	AbortService,
	FilteringService,
	LoadingService,
	LoadingState,
	PaginationService,
	PaginationState,
	SortingService,
	SortingState,
} from '../services'
import type {
	EntityListOptions,
	ListQueryParams,
	ListQueryResult,
} from './entity.types'

interface ListContext<TEntity, TId> {
	entities: ReadonlyData<ReadonlyMap<TId, TEntity>>
	getId(entity: TEntity): TId
	upsertMany(items: readonly TEntity[]): readonly TEntity[]
}

export class EntityList<TEntity, TId, TField, TFilters extends object> {
	readonly #options: EntityListOptions<TEntity, TField, TFilters>
	readonly #context: ListContext<TEntity, TId>
	readonly #membership: Data<readonly TId[]>
	readonly #ids: Data<readonly TId[]>
	readonly ids: ReadonlyData<readonly TId[]>
	readonly #items: Data<readonly TEntity[]>
	readonly items: ReadonlyData<readonly TEntity[]>
	readonly #loadingService?: LoadingService<string>
	readonly loading?: ReadonlyData<LoadingState>
	readonly #abortService?: AbortService<string>
	readonly #sortingService?: SortingService<TField>
	readonly sorting?: ReadonlyData<SortingState<TField>>
	readonly #filteringService?: FilteringService<TFilters>
	readonly filters?: ReadonlyData<TFilters>
	readonly #paginationService?: PaginationService
	readonly pagination?: ReadonlyData<PaginationState>
	readonly #unsubscribes: Unsubscribe[] = []
	#requestGeneration = 0
	#disposed = false

	constructor(
		readonly id: string,
		options: EntityListOptions<TEntity, TField, TFilters>,
		context: ListContext<TEntity, TId>,
	) {
		this.#options = options
		this.#context = context
		this.#membership = data<readonly TId[]>([])
		this.#ids = data<readonly TId[]>([])
		this.ids = readonlyData(this.#ids)
		this.#items = data<readonly TEntity[]>([])
		this.items = readonlyData(this.#items)
		this.#loadingService = options.loading ? options.loading() : undefined
		this.loading = this.#loadingService?.state('load')
		this.#abortService = options.abort ? options.abort() : undefined
		this.#sortingService = options.sorting
			? options.sorting.factory()
			: undefined
		this.sorting = this.#sortingService?.state
		this.#filteringService = options.filtering
			? options.filtering.factory()
			: undefined
		this.filters = this.#filteringService?.state
		this.#paginationService = options.pagination
			? options.pagination.factory()
			: undefined
		this.pagination = this.#paginationService?.state

		this.#unsubscribes.push(context.entities.subscribe(() => this.#recompute()))
		this.#unsubscribes.push(this.#membership.subscribe(() => this.#recompute()))
		if (this.sorting)
			this.#unsubscribes.push(this.sorting.subscribe(() => this.#recompute()))
		if (this.filters)
			this.#unsubscribes.push(this.filters.subscribe(() => this.#recompute()))
		if (this.pagination)
			this.#unsubscribes.push(
				this.pagination.subscribe(() => this.#recompute()),
			)
		this.#recompute()
	}

	replace(items: readonly TEntity[]): void {
		this.#assertActive()
		this.#context.upsertMany(items)
		if (this.#options.source === 'query')
			this.#membership.set(items.map(this.#context.getId))
	}

	append(items: readonly TEntity[]): void {
		this.#assertActive()
		this.#context.upsertMany(items)
		if (this.#options.source === 'query') {
			const ids = [...this.#membership.get(), ...items.map(this.#context.getId)]
			this.#membership.set([...new Set(ids)])
		}
	}

	remove(id: TId): void {
		if (this.#options.source === 'query')
			this.#membership.set(
				this.#membership.get().filter((value) => !Object.is(value, id)),
			)
	}

	clear(): void {
		if (this.#options.source === 'query') this.#membership.set([])
	}

	async load(): Promise<readonly TEntity[]> {
		this.#assertActive()
		if (this.#options.query === false || !this.#options.query)
			throw new Error(`Query is not configured for list "${this.id}"`)
		this.#paginationService?.setPage(1)
		return this.#loadPage(false)
	}

	async loadNextPage(): Promise<readonly TEntity[]> {
		this.#assertActive()
		if (!this.#paginationService)
			throw new Error(`Pagination is not configured for list "${this.id}"`)
		this.#paginationService.setPage(
			this.#paginationService.state.get().page + 1,
		)
		if (this.#options.pagination && this.#options.pagination.mode === 'client')
			return this.items.get()
		return this.#loadPage(true)
	}

	setSorting(value: Parameters<SortingService<TField>['set']>[0]): void {
		this.#required(this.#sortingService, 'Sorting').set(value)
	}
	setFilters(value: TFilters): void {
		this.#required(this.#filteringService, 'Filtering').set(value)
	}
	patchFilters(value: Partial<TFilters>): void {
		this.#required(this.#filteringService, 'Filtering').patch(value)
	}
	setPage(page: number): void {
		this.#required(this.#paginationService, 'Pagination').setPage(page)
	}
	setPageSize(pageSize: number): void {
		this.#required(this.#paginationService, 'Pagination').setPageSize(pageSize)
	}

	reset(): void {
		this.#sortingService?.reset()
		this.#filteringService?.reset()
		this.#paginationService?.reset()
	}

	handleEntityDeleted(id: TId): void {
		this.remove(id)
	}
	handleEntitiesCleared(): void {
		if (this.#options.source === 'query') this.#membership.set([])
	}

	dispose(): void {
		if (this.#disposed) return
		this.#disposed = true
		this.#requestGeneration++
		for (const unsubscribe of this.#unsubscribes) unsubscribe()
		this.#abortService?.dispose()
		this.#loadingService?.dispose()
	}

	async #loadPage(append: boolean): Promise<readonly TEntity[]> {
		const query = this.#options.query
		if (!query) throw new Error(`Query is not configured for list "${this.id}"`)
		const params = this.#serverParams()
		const generation = ++this.#requestGeneration
		const operation = (signal: AbortSignal) => query(params, signal)
		const transport = () =>
			this.#abortService
				? this.#abortService.run('load', operation)
				: operation(new AbortController().signal)
		const result = await (this.#loadingService
			? this.#loadingService.run('load', transport)
			: transport())
		if (generation !== this.#requestGeneration || this.#disposed)
			return this.items.get()
		this.#applyQueryResult(result, append)
		return result.items
	}

	#applyQueryResult(result: ListQueryResult<TEntity>, append: boolean): void {
		if (
			this.#options.pagination &&
			this.#options.pagination.mode === 'server'
		) {
			if (result.total === undefined)
				throw new Error(
					`Server pagination query for list "${this.id}" must return total`,
				)
			this.#paginationService?.setTotal(result.total)
		}
		this.#context.upsertMany(result.items)
		const ids = result.items.map(this.#context.getId)
		this.#membership.set(
			append ? [...new Set([...this.#membership.get(), ...ids])] : ids,
		)
	}

	#serverParams(): ListQueryParams<TField, TFilters> {
		const params: ListQueryParams<TField, TFilters> = {}
		if (this.#options.sorting && this.#options.sorting.mode === 'server')
			params.sorting = this.#sortingService?.state.get()
		if (this.#options.filtering && this.#options.filtering.mode === 'server')
			params.filters = this.#filteringService?.state.get()
		if (
			this.#options.pagination &&
			this.#options.pagination.mode === 'server'
		) {
			const state = this.#paginationService?.state.get()
			if (state)
				params.pagination = {
					page: state.page,
					pageSize: state.pageSize,
					offset: (state.page - 1) * state.pageSize,
					limit: state.pageSize,
				}
		}
		return params
	}

	#recompute(): void {
		const entities = this.#context.entities.get()
		const baseIds =
			this.#options.source === 'entities'
				? [...entities.keys()]
				: this.#membership.get()
		let result = baseIds.flatMap((id) => {
			const entity = entities.get(id)
			return entity === undefined ? [] : [entity]
		})
		if (this.#options.filtering && this.#options.filtering.mode === 'client') {
			const predicate = this.#options.filtering.predicate
			if (!predicate)
				throw new Error(
					`Client filtering for list "${this.id}" requires a predicate`,
				)
			const filters = this.#filteringService?.state.get() as TFilters
			result = result.filter((entity) => predicate(entity, filters))
		}
		if (this.#options.sorting && this.#options.sorting.mode === 'client') {
			const comparator = this.#options.sorting.comparator
			if (!comparator)
				throw new Error(
					`Client sorting for list "${this.id}" requires a comparator`,
				)
			const sorting = this.#sortingService?.state.get()
			if (sorting) {
				const direction = sorting.direction === 'asc' ? 1 : -1
				result = [...result].sort(
					(left, right) => direction * comparator(left, right, sorting.field),
				)
			}
		}
		if (
			this.#options.pagination &&
			this.#options.pagination.mode === 'client'
		) {
			const state = this.#paginationService?.state.get()
			if (state) {
				if (state.total !== result.length)
					this.#paginationService?.setTotal(result.length)
				const offset = (state.page - 1) * state.pageSize
				result = result.slice(offset, offset + state.pageSize)
			}
		}
		this.#items.set(result)
		this.#ids.set(result.map(this.#context.getId))
	}

	#required<T>(value: T | undefined, name: string): T {
		if (!value)
			throw new Error(`${name} is not configured for list "${this.id}"`)
		return value
	}

	#assertActive(): void {
		if (this.#disposed)
			throw new Error(`Entity list "${this.id}" has been disposed`)
	}
}
