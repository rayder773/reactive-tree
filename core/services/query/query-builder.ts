import {
	ParallelQueryConcurrencyService,
	type ConcurrencyPlugin,
} from './query-concurrency'
import { QueryOperation } from './query-operation'
import {
	QUERY_SOURCE_INTERNAL,
	type QueryConcurrencyApi,
	type QueryInterceptor,
	type QueryOperationMode,
	type QueryPlugin,
	type QueryRequestContext,
	type QueryResult,
	type QueryRunner,
	type QuerySource,
	type UniversalQueryPlugin,
} from './query.types'

type EmptyApi = Record<never, never>
type MergeServices<TCurrent extends object, TAdded extends object> =
	keyof TCurrent extends never
		? TAdded
		: keyof TAdded extends never
			? TCurrent
			: TCurrent & TAdded
type NoKeyOverlap<TExisting, TAdded> = Extract<keyof TExisting, keyof TAdded> extends never
	? unknown
	: { readonly __queryPluginApiKeysMustBeUnique: never }
type QueryRuntimeKeys<TEntity, TInput> = QueryRequestContext<TInput> & {
	readonly kind: 'query-source'
	readonly replace: (input: TInput) => Promise<QueryResult<TEntity>>
	readonly append: (input: TInput) => Promise<QueryResult<TEntity>>
	dispose(): void
}

const mergeApi = (target: object, api: object): void => {
	for (const key of Reflect.ownKeys(api)) {
		if (key in target) {
			throw new Error(`Query plugin API key "${String(key)}" already exists`)
		}
		Object.defineProperty(
			target,
			key,
			Object.getOwnPropertyDescriptor(api, key) as PropertyDescriptor,
		)
	}
}

export class QueryBuilder<
	TEntity,
	TInput = void,
	TServices extends object = EmptyApi,
> {
	readonly #plugins: ReadonlyArray<
		QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>
	>

	constructor(
		plugins: ReadonlyArray<
			QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>
		> = [],
	) {
		this.#plugins = plugins
	}

	use<TAdded extends object>(
		plugin: (
			| QueryPlugin<TEntity, TInput, TAdded>
			| UniversalQueryPlugin<TAdded>
		) &
			NoKeyOverlap<TServices & QueryRuntimeKeys<TEntity, TInput>, TAdded>,
	): QueryBuilder<TEntity, TInput, MergeServices<TServices, TAdded>> {
		if (
			plugin.kind === 'query-concurrency' &&
			this.#plugins.some((item) => item.kind === 'query-concurrency')
		) {
			throw new Error('Only one query concurrency plugin is allowed')
		}
		return new QueryBuilder<
			TEntity,
			TInput,
			MergeServices<TServices, TAdded>
		>([...this.#plugins, plugin])
	}

	request(
		handler: (
			context: QueryRequestContext<TInput> & TServices,
		) => Promise<readonly TEntity[]>,
	): QuerySource<TEntity, TInput, TServices> {
		return createQuery(this.#plugins, handler)
	}
}

const createQuery = <TEntity, TInput, TServices extends object>(
	plugins: ReadonlyArray<
		QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>
	>,
	handler: (
		context: QueryRequestContext<TInput> & TServices,
	) => Promise<readonly TEntity[]>,
): QuerySource<TEntity, TInput, TServices> => {
	const interceptors: QueryInterceptor<TEntity, TInput>[] = []
	const disposeCallbacks: Array<() => void> = []
	const applyCallbacks = new Set<
		(mode: QueryOperationMode, entities: readonly TEntity[]) => void
	>()
	const services: object = {}
	const pluginContext = {
		interceptRequest: (value: QueryInterceptor<TEntity, TInput>) =>
			interceptors.push(value),
		onDispose: (callback: () => void) => disposeCallbacks.push(callback),
	}
	for (const plugin of plugins) mergeApi(services, plugin.install(pluginContext))

	let execute: QueryRunner<TEntity, TInput> = (input, signal) =>
		handler({ ...(services as TServices), input, signal })
	for (const interceptor of [...interceptors].reverse()) {
		execute = interceptor(execute)
	}

	const concurrencyPlugin = plugins.find(
		(plugin): plugin is ConcurrencyPlugin<TEntity, TInput> =>
			plugin.kind === 'query-concurrency',
	)
	const concurrency =
		concurrencyPlugin?.create() ??
		new ParallelQueryConcurrencyService<TEntity, TInput>()
	mergeApi(services, {
		concurrency: {
			strategy: concurrency.strategy,
			activeIds: concurrency.activeIds,
			pendingIds: concurrency.pendingIds,
			cancel: (id: number) => concurrency.cancel(id),
			cancelAll: () => concurrency.cancelAll(),
		},
	})

	let disposed = false
	let nextOperationId = 0
	const apply = (mode: QueryOperationMode, entities: readonly TEntity[]) => {
		for (const callback of applyCallbacks) callback(mode, entities)
	}
	const run = (mode: QueryOperationMode, input: TInput) => {
		const operation = new QueryOperation(
			++nextOperationId,
			mode,
			input,
			(signal) => execute(input, signal),
			apply,
		)
		if (disposed) return Promise.resolve(operation.skip('disposed'))
		return concurrency.execute(operation)
	}
	const dispose = () => {
		if (disposed) return
		disposed = true
		concurrency.dispose()
		applyCallbacks.clear()
		for (const callback of [...disposeCallbacks].reverse()) callback()
	}

	const source = services as TServices &
		QueryConcurrencyApi & {
			kind: 'query-source'
			replace(input?: TInput): Promise<QueryResult<TEntity>>
			append(input?: TInput): Promise<QueryResult<TEntity>>
			dispose(): void
		}
	Object.defineProperties(source, {
		kind: { value: 'query-source', enumerable: true },
		replace: { value: (input?: TInput) => run('replace', input as TInput) },
		append: { value: (input?: TInput) => run('append', input as TInput) },
		dispose: { value: dispose },
		[QUERY_SOURCE_INTERNAL]: {
			value: {
				onApply: (
					callback: (
						mode: QueryOperationMode,
						entities: readonly TEntity[],
					) => void,
				) => {
					if (disposed) throw new Error('Query has been disposed')
					applyCallbacks.add(callback)
					return () => applyCallbacks.delete(callback)
				},
			},
		},
	})
	return source as QuerySource<TEntity, TInput, TServices>
}

export const query = <TEntity, TInput = void>() =>
	new QueryBuilder<TEntity, TInput>()
