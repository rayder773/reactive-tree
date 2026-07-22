import type { ReadonlyData } from '../../data'
import type { QueryOperation } from './query-operation'

export type QueryResult<TEntity> =
	| { status: 'applied'; operationId: number; entities: readonly TEntity[] }
	| {
		status: 'skipped'
		operationId: number
		reason: 'superseded' | 'busy' | 'cancelled' | 'disposed'
		entities?: readonly TEntity[]
	}

export type QueryCommand<TInput, TEntity> = [TInput] extends [void]
	? () => Promise<QueryResult<TEntity>>
	: (input: TInput) => Promise<QueryResult<TEntity>>

export type QueryApi<TEntity, TInput, TServices extends object> = {
	readonly query: QuerySource<TEntity, TInput, TServices>
}

export const QUERY_SOURCE_INTERNAL: unique symbol = Symbol('query-source-internal')

export interface QuerySourceInternal<TEntity, TInput, TServices extends object> {
	onApply(
		callback: (mode: QueryOperationMode, entities: readonly TEntity[]) => void,
	): () => void
	readonly types?: {
		readonly input: TInput
		readonly services: TServices
	}
}

export type QuerySource<TEntity, TInput, TServices extends object> = TServices &
	QueryConcurrencyApi & {
		readonly kind: 'query-source'
		readonly replace: QueryCommand<TInput, TEntity>
		readonly append: QueryCommand<TInput, TEntity>
		dispose(): void
		readonly [QUERY_SOURCE_INTERNAL]: QuerySourceInternal<
			TEntity,
			TInput,
			TServices
		>
	}

export type AnyQuerySource<TEntity> = {
	readonly kind: 'query-source'
	readonly [QUERY_SOURCE_INTERNAL]: QuerySourceInternal<TEntity, any, any>
}

export type QuerySourceInput<TSource> = TSource extends {
	readonly [QUERY_SOURCE_INTERNAL]: QuerySourceInternal<any, infer TInput, any>
}
	? TInput
	: never

export type QuerySourceServices<TSource> = TSource extends {
	readonly [QUERY_SOURCE_INTERNAL]: QuerySourceInternal<any, any, infer TServices>
}
	? TServices
	: never

export type QueryRunner<TEntity, TInput> = (
	input: TInput,
	signal: AbortSignal,
) => Promise<readonly TEntity[]>

export type QueryInterceptor<TEntity, TInput> = (
	next: QueryRunner<TEntity, TInput>,
) => QueryRunner<TEntity, TInput>

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

export interface QueryRequestContext<TInput> {
	readonly input: TInput
	readonly signal: AbortSignal
}

export type QueryOperationMode = 'replace' | 'append'

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
