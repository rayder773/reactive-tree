import type { QueryOperationMode, QueryResult } from './query.types'

type SkipReason = 'superseded' | 'busy' | 'cancelled' | 'disposed'

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
		this.result = new Promise((resolve, reject) => {
			this.#resolve = resolve
			this.#reject = reject
		})
	}

	request(signal: AbortSignal): Promise<readonly TEntity[]> {
		if (this.#settled || this.#requested) {
			throw new Error('Query operation cannot be requested')
		}
		this.#requested = true
		return this.#runRequest(signal)
	}

	apply(entities: readonly TEntity[]): QueryResult<TEntity> {
		this.#assertOpen()
		this.#applyEntities(this.mode, entities)
		const result = {
			status: 'applied',
			operationId: this.operationId,
			entities,
		} as const
		this.#finish(result)
		return result
	}

	skip(reason: SkipReason, entities?: readonly TEntity[]): QueryResult<TEntity> {
		this.#assertOpen()
		const result: QueryResult<TEntity> = {
			status: 'skipped',
			operationId: this.operationId,
			reason,
			...(entities ? { entities } : {}),
		}
		this.#finish(result)
		return result
	}

	get settled(): boolean {
		return this.#settled
	}

	fail(error: unknown): void {
		this.#assertOpen()
		this.#settled = true
		this.#reject(error)
	}

	#assertOpen(): void {
		if (this.#settled) throw new Error('Query operation has completed')
	}

	#finish(result: QueryResult<TEntity>): void {
		this.#settled = true
		this.#resolve(result)
	}
}
