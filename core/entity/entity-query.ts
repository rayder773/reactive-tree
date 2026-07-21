import { data, readonlyData, type Data, type ReadonlyData } from '../data'
import {
	AbortService,
	FilteringService,
	LoadingService,
	type LoadingState,
	PaginationService,
	type PaginationState,
	SortingService,
	type SortingState,
} from '../services'
import {
	ENTITY_STORE_INTERNAL,
	type EntityListPluginContext,
	type NoPluginKeyOverlap,
	type QueryApi,
	type QueryResult,
} from './entity.types'

type EmptyApi = Record<never, never>
type QueryRunner<TEntity, TInput> = (input: TInput, signal: AbortSignal) => Promise<readonly TEntity[]>
type QueryInterceptor<TEntity, TInput> = (next: QueryRunner<TEntity, TInput>) => QueryRunner<TEntity, TInput>
type SkipReason = 'superseded' | 'busy' | 'cancelled' | 'disposed'

export interface QueryPluginContext<TEntity, TInput> {
	interceptRequest(interceptor: QueryInterceptor<TEntity, TInput>): void
	onDispose(callback: () => void): void
}

export interface QueryPlugin<TEntity, TInput, TAdded extends object> {
	readonly kind?: 'query-plugin' | 'query-concurrency'
	install(context: QueryPluginContext<TEntity, TInput>): TAdded
}

export interface UniversalQueryPlugin<TAdded extends object> {
	readonly kind?: 'query-plugin'
	install<TEntity, TInput>(context: QueryPluginContext<TEntity, TInput>): TAdded
}

export interface QueryRequestContext<TInput> { readonly input: TInput; readonly signal: AbortSignal }

export type QueryOperationMode = 'replace' | 'append'

export class QueryOperation<TEntity, TInput> {
	readonly result: Promise<QueryResult<TEntity>>
	#resolve!: (result: QueryResult<TEntity>) => void
	#reject!: (error: unknown) => void
	#settled = false
	#requested = false
	readonly #runRequest: (signal: AbortSignal) => Promise<readonly TEntity[]>
	readonly #applyEntities: (
		mode: QueryOperationMode,
		entities: readonly TEntity[],
	) => void

	constructor(
		readonly operationId: number,
		readonly mode: QueryOperationMode,
		readonly input: TInput,
		runRequest: (signal: AbortSignal) => Promise<readonly TEntity[]>,
		applyEntities: (mode: QueryOperationMode, entities: readonly TEntity[]) => void,
	) {
		this.#runRequest = runRequest
		this.#applyEntities = applyEntities
		this.result = new Promise((resolve, reject) => { this.#resolve = resolve; this.#reject = reject })
	}

	request(signal: AbortSignal): Promise<readonly TEntity[]> {
		if (this.#settled || this.#requested) throw new Error('Query operation cannot be requested')
		this.#requested = true
		return this.#runRequest(signal)
	}

	apply(entities: readonly TEntity[]): QueryResult<TEntity> {
		this.#assertOpen()
		this.#applyEntities(this.mode, entities)
		const result = { status: 'applied', operationId: this.operationId, entities } as const
		this.#finish(result)
		return result
	}

	skip(reason: SkipReason, entities?: readonly TEntity[]): QueryResult<TEntity> {
		this.#assertOpen()
		const result: QueryResult<TEntity> = { status: 'skipped', operationId: this.operationId, reason, ...(entities ? { entities } : {}) }
		this.#finish(result)
		return result
	}

	get settled(): boolean { return this.#settled }
	fail(error: unknown): void { this.#assertOpen(); this.#settled = true; this.#reject(error) }
	#assertOpen(): void { if (this.#settled) throw new Error('Query operation has completed') }
	#finish(result: QueryResult<TEntity>): void { this.#settled = true; this.#resolve(result) }
}

export interface QueryConcurrencyService<TEntity, TInput> {
	readonly strategy: string
	readonly activeIds: ReadonlyData<readonly number[]>
	readonly pendingIds: ReadonlyData<readonly number[]>
	execute(operation: QueryOperation<TEntity, TInput>): Promise<QueryResult<TEntity>>
	cancel(operationId: number): void
	cancelAll(): void
	dispose(): void
}

export interface QueryConcurrencyApi {
	readonly concurrency: {
		readonly strategy: string
		readonly activeIds: ReadonlyData<readonly number[]>
		readonly pendingIds: ReadonlyData<readonly number[]>
		cancel(operationId: number): void
		cancelAll(): void
	}
}

const isAbortError = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'

abstract class BuiltInConcurrency<TEntity, TInput> implements QueryConcurrencyService<TEntity, TInput> {
	readonly #active: Data<readonly number[]> = data([])
	readonly #pending: Data<readonly number[]> = data([])
	readonly activeIds = readonlyData(this.#active)
	readonly pendingIds = readonlyData(this.#pending)
	protected readonly aborts = new AbortService<number>()
	protected readonly operations = new Map<number, QueryOperation<TEntity, TInput>>()
	protected pending: QueryOperation<TEntity, TInput>[] = []
	protected disposed = false
	abstract readonly strategy: string
	abstract execute(operation: QueryOperation<TEntity, TInput>): Promise<QueryResult<TEntity>>

	protected async run(operation: QueryOperation<TEntity, TInput>, apply: boolean | (() => boolean) = true, superseded = false): Promise<QueryResult<TEntity>> {
		if (this.disposed) return operation.skip('disposed')
		this.operations.set(operation.operationId, operation)
		this.#active.set([...this.#active.get(), operation.operationId])
		const controller = this.aborts.create(operation.operationId)
		try {
			const outcome = await Promise.race([
				operation.request(controller.signal).then((entities) => ({
					kind: 'requested' as const,
					entities,
				})),
				operation.result.then(() => ({ kind: 'completed' as const })),
			])
			if (outcome.kind === 'completed' || operation.settled)
				return operation.result
			const { entities } = outcome
			return (typeof apply === 'function' ? apply() : apply) ? operation.apply(entities) : operation.skip(superseded ? 'superseded' : 'cancelled', entities)
		} catch (error) {
			if (operation.settled) return operation.result
			if (controller.signal.aborted && isAbortError(error)) return operation.skip(this.disposed ? 'disposed' : superseded ? 'superseded' : 'cancelled')
			throw error
		} finally {
			this.aborts.release(operation.operationId)
			this.operations.delete(operation.operationId)
			this.#active.set(this.#active.get().filter((id) => id !== operation.operationId))
		}
	}

	protected publishPending(): void { this.#pending.set(this.pending.map((operation) => operation.operationId)) }
	cancel(id: number): void {
		const queued = this.pending.find((operation) => operation.operationId === id)
		if (queued) { this.pending = this.pending.filter((operation) => operation !== queued); this.publishPending(); queued.skip('cancelled'); return }
		const active = this.operations.get(id)
		if (active && !active.settled) active.skip('cancelled')
		this.aborts.abort(id)
	}
	cancelAll(): void {
		for (const operation of this.pending) if (!operation.settled) operation.skip('cancelled')
		for (const operation of this.operations.values()) if (!operation.settled) operation.skip('cancelled')
		this.pending = []; this.publishPending(); this.aborts.abortAll()
	}
	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		for (const operation of this.pending) if (!operation.settled) operation.skip('disposed')
		for (const operation of this.operations.values()) if (!operation.settled) operation.skip('disposed')
		this.pending = []; this.publishPending(); this.aborts.abortAll(); this.aborts.dispose()
	}
}

export class ParallelQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<TEntity, TInput> {
	readonly strategy = 'parallel'
	execute(operation: QueryOperation<TEntity, TInput>) { return this.run(operation) }
}

export class LatestQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<TEntity, TInput> {
	readonly strategy = 'latest'
	#latest = 0
	constructor(readonly cancelPrevious = false) { super() }
	execute(operation: QueryOperation<TEntity, TInput>) {
		this.#latest = operation.operationId
		for (const [id, previous] of this.operations) if (id !== operation.operationId && !previous.settled) {
			previous.skip('superseded')
			if (this.cancelPrevious) this.aborts.abort(id)
		}
		return this.runLatest(operation)
	}
	async runLatest(operation: QueryOperation<TEntity, TInput>) {
		const result = await this.run(operation, () => operation.operationId === this.#latest, true)
		return result
	}
}

export class QueueQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<TEntity, TInput> {
	readonly strategy = 'queue'
	#running = false
	execute(operation: QueryOperation<TEntity, TInput>) {
		if (this.disposed) return Promise.resolve(operation.skip('disposed'))
		this.pending.push(operation); this.publishPending(); void this.#drain(); return operation.result
	}
	async #drain(): Promise<void> {
		if (this.#running) return
		this.#running = true
		while (this.pending.length) {
			const operation = this.pending.shift() as QueryOperation<TEntity, TInput>; this.publishPending()
			if (operation.settled) continue
			try { await this.run(operation) } catch (error) { if (!operation.settled) operation.fail(error) }
		}
		this.#running = false
	}
}

export class ExhaustQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<TEntity, TInput> {
	readonly strategy = 'exhaust'
	execute(operation: QueryOperation<TEntity, TInput>) {
		return this.activeIds.get().length ? Promise.resolve(operation.skip('busy')) : this.run(operation)
	}
}

export interface QueryConcurrencyOptions<TEntity, TInput> {
	create(): QueryConcurrencyService<TEntity, TInput>
}

interface ConcurrencyPlugin<TEntity, TInput> extends QueryPlugin<TEntity, TInput, EmptyApi> {
	readonly kind: 'query-concurrency'
	create(): QueryConcurrencyService<TEntity, TInput>
}

export const queryConcurrency = <TEntity, TInput = void>(factory: () => QueryConcurrencyService<TEntity, TInput>): ConcurrencyPlugin<TEntity, TInput> => ({
	kind: 'query-concurrency', create: factory, install: () => ({}),
})
export const queryConcurrencyParallel = <TEntity, TInput = void>() => queryConcurrency(() => new ParallelQueryConcurrencyService<TEntity, TInput>())
export const queryConcurrencyLatest = <TEntity, TInput = void>(options: { cancelPrevious?: boolean } = {}) => queryConcurrency(() => new LatestQueryConcurrencyService<TEntity, TInput>(options.cancelPrevious))
export const queryConcurrencyQueue = <TEntity, TInput = void>() => queryConcurrency(() => new QueueQueryConcurrencyService<TEntity, TInput>())
export const queryConcurrencyExhaust = <TEntity, TInput = void>() => queryConcurrency(() => new ExhaustQueryConcurrencyService<TEntity, TInput>())

export interface QuerySourcePlugin<TEntity, TInput, TServices extends object> {
	readonly kind: 'query-source'; readonly membership: true
	install(context: EntityListPluginContext<TEntity, unknown>): QueryApi<TEntity, TInput, TServices>
}

const mergeApi = (target: object, api: object): void => {
	for (const key of Reflect.ownKeys(api)) {
		if (key in target) throw new Error(`Query plugin API key "${String(key)}" already exists`)
		Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(api, key) as PropertyDescriptor)
	}
}

export class QueryBuilder<TEntity, TInput = void, TServices extends object = EmptyApi> {
	readonly #plugins: ReadonlyArray<QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>>
	constructor(plugins: ReadonlyArray<QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>> = []) { this.#plugins = plugins }
	use<TAdded extends object>(plugin: (QueryPlugin<TEntity, TInput, TAdded> | UniversalQueryPlugin<TAdded>) & NoPluginKeyOverlap<TServices & QueryRequestContext<TInput>, TAdded>): QueryBuilder<TEntity, TInput, TServices & TAdded> {
		if (plugin.kind === 'query-concurrency' && this.#plugins.some((item) => item.kind === 'query-concurrency')) throw new Error('Only one query concurrency plugin is allowed')
		return new QueryBuilder([...this.#plugins, plugin])
	}
	request(handler: (context: QueryRequestContext<TInput> & TServices) => Promise<readonly TEntity[]>): QuerySourcePlugin<TEntity, TInput, TServices & QueryConcurrencyApi> {
		const plugins = this.#plugins
		return { kind: 'query-source', membership: true, install(sourceContext) {
			const interceptors: QueryInterceptor<TEntity, TInput>[] = [], disposeCallbacks: Array<() => void> = [], services: object = {}
			const pluginContext: QueryPluginContext<TEntity, TInput> = { interceptRequest: (value) => interceptors.push(value), onDispose: (callback) => disposeCallbacks.push(callback) }
			for (const plugin of plugins) mergeApi(services, plugin.install(pluginContext))
			let execute: QueryRunner<TEntity, TInput> = (input, signal) => handler({ ...(services as TServices), input, signal })
			for (const interceptor of [...interceptors].reverse()) execute = interceptor(execute)
			const concurrencyPlugin = plugins.find((plugin): plugin is ConcurrencyPlugin<TEntity, TInput> => plugin.kind === 'query-concurrency')
			const concurrency = concurrencyPlugin?.create() ?? new ParallelQueryConcurrencyService<TEntity, TInput>()
			mergeApi(services, { concurrency: { strategy: concurrency.strategy, activeIds: concurrency.activeIds, pendingIds: concurrency.pendingIds, cancel: (id: number) => concurrency.cancel(id), cancelAll: () => concurrency.cancelAll() } })
			let disposed = false, nextOperationId = 0
			sourceContext.setMembershipSource(() => sourceContext.membership.get())
			const removeDeleted = sourceContext.store[ENTITY_STORE_INTERNAL].onDelete((id) => sourceContext.setMembership(sourceContext.membership.get().filter((value) => !Object.is(value, id))))
			const clearDeleted = sourceContext.store[ENTITY_STORE_INTERNAL].onClear(() => sourceContext.setMembership([]))
			sourceContext.onDispose(removeDeleted); sourceContext.onDispose(clearDeleted)
			sourceContext.onDispose(() => { disposed = true; concurrency.dispose(); for (const callback of [...disposeCallbacks].reverse()) callback() })
			const apply = (mode: QueryOperationMode, entities: readonly TEntity[]) => {
				sourceContext.store.upsertMany(entities); const ids = entities.map(sourceContext.getId)
				if (mode === 'replace') sourceContext.setMembership([...new Set(ids)])
				else { const current = sourceContext.membership.get(); sourceContext.setMembership([...current, ...[...new Set(ids)].filter((id) => !current.some((value) => Object.is(value, id)))]) }
			}
			const run = (mode: QueryOperationMode, input: TInput) => {
				const operation = new QueryOperation(++nextOperationId, mode, input, (signal) => execute(input, signal), apply)
				if (disposed) return Promise.resolve(operation.skip('disposed'))
				return concurrency.execute(operation)
			}
			const facade = services as TServices & QueryConcurrencyApi & { replace(input?: TInput): Promise<QueryResult<TEntity>>; append(input?: TInput): Promise<QueryResult<TEntity>> }
			Object.defineProperties(facade, { replace: { value: (input?: TInput) => run('replace', input as TInput) }, append: { value: (input?: TInput) => run('append', input as TInput) } })
			return { query: facade } as QueryApi<TEntity, TInput, TServices & QueryConcurrencyApi>
		} }
	}
}

export const query = <TEntity, TInput = void>() => new QueryBuilder<TEntity, TInput>()

export interface QueryLoadingApi { readonly loading: { readonly state: ReadonlyData<LoadingState>; readonly activeCount: ReadonlyData<number>; reset(): void } }
export const queryLoading = (): UniversalQueryPlugin<QueryLoadingApi> => ({ install(context) {
	const service = new LoadingService<'query'>()
	context.interceptRequest((next) => (input, signal) => service.run('query', () => next(input, signal), signal))
	context.onDispose(() => service.dispose())
	return { loading: { state: service.state('query'), activeCount: service.activeCount('query'), reset: () => service.reset('query') } }
} })

export interface QuerySortingApi<TField> { readonly sorting: SortingService<TField> }
export const querySorting = <TField>(initial: SortingState<TField>): UniversalQueryPlugin<QuerySortingApi<TField>> => ({ install: () => ({ sorting: new SortingService(initial) }) })
export interface QueryFilteringApi<TFilters extends object> { readonly filtering: FilteringService<TFilters> }
export const queryFiltering = <TFilters extends object>(initial: TFilters): UniversalQueryPlugin<QueryFilteringApi<TFilters>> => ({ install: () => ({ filtering: new FilteringService(initial) }) })
export interface QueryPaginationApi { readonly pagination: PaginationService }
export const queryPagination = (initial: Partial<PaginationState> = {}): UniversalQueryPlugin<QueryPaginationApi> => ({ install: () => ({ pagination: new PaginationService(initial) }) })
