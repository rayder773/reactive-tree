import type { AsyncExecutor } from '../types/runtime'
import type { Store } from '../types/store'

export class AbortService {
	constructor(
		private readonly store: Store<AbortController>,
		private readonly executeAsync: AsyncExecutor,
	) {}

	async run<T>(
		callback: (signal: AbortSignal) => T | Promise<T>,
		key?: string,
	): Promise<T> {
		const previousController = this.store.get(key)

		if (previousController !== undefined) {
			previousController.abort()
		}

		const controller = new AbortController()
		this.store.set(controller, key)

		return this.executeAsync('callback', () => callback(controller.signal))
	}
}
