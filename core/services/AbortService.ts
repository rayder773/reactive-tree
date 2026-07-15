import type { Store, StoreKey } from '../types/store'

export class AbortService {
	constructor(private readonly store: Store<AbortController>) {}

	async run<T>(
		callback: (signal: AbortSignal) => T | Promise<T>,
		key?: StoreKey,
	): Promise<T> {
		const previousController = this.store.get(key)

		if (previousController !== undefined) {
			previousController.abort()
		}

		const controller = new AbortController()
		this.store.set(controller, key)

		return callback(controller.signal)
	}
}
