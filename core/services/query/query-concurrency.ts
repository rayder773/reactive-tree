import { data, readonlyData, type Data } from '../../data'
import { AbortService } from '../abort-service'
import { QueryOperation } from './query-operation'
import type {
	QueryConcurrencyService,
	QueryPlugin,
	QueryResult,
} from './query.types'

type EmptyApi = Record<never, never>

const isAbortError = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'name' in error &&
	error.name === 'AbortError'

abstract class BuiltInConcurrency<TEntity, TInput>
	implements QueryConcurrencyService<TEntity, TInput>
{
	readonly #active: Data<readonly number[]> = data([])
	readonly #pending: Data<readonly number[]> = data([])
	readonly activeIds = readonlyData(this.#active)
	readonly pendingIds = readonlyData(this.#pending)
	protected readonly aborts = new AbortService<number>()
	protected readonly operations = new Map<number, QueryOperation<TEntity, TInput>>()
	protected pending: QueryOperation<TEntity, TInput>[] = []
	protected disposed = false
	abstract readonly strategy: string
	abstract execute(
		operation: QueryOperation<TEntity, TInput>,
	): Promise<QueryResult<TEntity>>

	protected async run(
		operation: QueryOperation<TEntity, TInput>,
		apply: boolean | (() => boolean) = true,
		superseded = false,
	): Promise<QueryResult<TEntity>> {
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
			if (outcome.kind === 'completed' || operation.settled) {
				return operation.result
			}
			const { entities } = outcome
			return (typeof apply === 'function' ? apply() : apply)
				? operation.apply(entities)
				: operation.skip(superseded ? 'superseded' : 'cancelled', entities)
		} catch (error) {
			if (operation.settled) return operation.result
			if (controller.signal.aborted && isAbortError(error)) {
				return operation.skip(
					this.disposed
						? 'disposed'
						: superseded
							? 'superseded'
							: 'cancelled',
				)
			}
			throw error
		} finally {
			this.aborts.release(operation.operationId)
			this.operations.delete(operation.operationId)
			this.#active.set(
				this.#active.get().filter((id) => id !== operation.operationId),
			)
		}
	}

	protected publishPending(): void {
		this.#pending.set(this.pending.map((operation) => operation.operationId))
	}

	cancel(id: number): void {
		const queued = this.pending.find((operation) => operation.operationId === id)
		if (queued) {
			this.pending = this.pending.filter((operation) => operation !== queued)
			this.publishPending()
			queued.skip('cancelled')
			return
		}
		const active = this.operations.get(id)
		if (active && !active.settled) active.skip('cancelled')
		this.aborts.abort(id)
	}

	cancelAll(): void {
		for (const operation of this.pending) {
			if (!operation.settled) operation.skip('cancelled')
		}
		for (const operation of this.operations.values()) {
			if (!operation.settled) operation.skip('cancelled')
		}
		this.pending = []
		this.publishPending()
		this.aborts.abortAll()
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		for (const operation of this.pending) {
			if (!operation.settled) operation.skip('disposed')
		}
		for (const operation of this.operations.values()) {
			if (!operation.settled) operation.skip('disposed')
		}
		this.pending = []
		this.publishPending()
		this.aborts.abortAll()
		this.aborts.dispose()
	}
}

export class ParallelQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<
	TEntity,
	TInput
> {
	readonly strategy = 'parallel'
	execute(operation: QueryOperation<TEntity, TInput>) {
		return this.run(operation)
	}
}

export class LatestQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<
	TEntity,
	TInput
> {
	readonly strategy = 'latest'
	#latest = 0

	constructor(readonly cancelPrevious = false) {
		super()
	}

	execute(operation: QueryOperation<TEntity, TInput>) {
		this.#latest = operation.operationId
		for (const [id, previous] of this.operations) {
			if (id !== operation.operationId && !previous.settled) {
				previous.skip('superseded')
				if (this.cancelPrevious) this.aborts.abort(id)
			}
		}
		return this.runLatest(operation)
	}

	async runLatest(operation: QueryOperation<TEntity, TInput>) {
		return this.run(operation, () => operation.operationId === this.#latest, true)
	}
}

export class QueueQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<
	TEntity,
	TInput
> {
	readonly strategy = 'queue'
	#running = false

	execute(operation: QueryOperation<TEntity, TInput>) {
		if (this.disposed) return Promise.resolve(operation.skip('disposed'))
		this.pending.push(operation)
		this.publishPending()
		void this.#drain()
		return operation.result
	}

	async #drain(): Promise<void> {
		if (this.#running) return
		this.#running = true
		while (this.pending.length) {
			const operation = this.pending.shift() as QueryOperation<TEntity, TInput>
			this.publishPending()
			if (operation.settled) continue
			try {
				await this.run(operation)
			} catch (error) {
				if (!operation.settled) operation.fail(error)
			}
		}
		this.#running = false
	}
}

export class ExhaustQueryConcurrencyService<TEntity, TInput> extends BuiltInConcurrency<
	TEntity,
	TInput
> {
	readonly strategy = 'exhaust'
	execute(operation: QueryOperation<TEntity, TInput>) {
		return this.activeIds.get().length
			? Promise.resolve(operation.skip('busy'))
			: this.run(operation)
	}
}

export interface ConcurrencyPlugin<TEntity, TInput>
	extends QueryPlugin<TEntity, TInput, EmptyApi> {
	readonly kind: 'query-concurrency'
	create(): QueryConcurrencyService<TEntity, TInput>
}

export const queryConcurrency = <TEntity, TInput = void>(
	factory: () => QueryConcurrencyService<TEntity, TInput>,
): ConcurrencyPlugin<TEntity, TInput> => ({
	kind: 'query-concurrency',
	create: factory,
	install: () => ({}),
})

export const queryConcurrencyParallel = <TEntity, TInput = void>() =>
	queryConcurrency(() => new ParallelQueryConcurrencyService<TEntity, TInput>())

export const queryConcurrencyLatest = <TEntity, TInput = void>(
	options: { cancelPrevious?: boolean } = {},
) =>
	queryConcurrency(
		() =>
			new LatestQueryConcurrencyService<TEntity, TInput>(options.cancelPrevious),
	)

export const queryConcurrencyQueue = <TEntity, TInput = void>() =>
	queryConcurrency(() => new QueueQueryConcurrencyService<TEntity, TInput>())

export const queryConcurrencyExhaust = <TEntity, TInput = void>() =>
	queryConcurrency(() => new ExhaustQueryConcurrencyService<TEntity, TInput>())
