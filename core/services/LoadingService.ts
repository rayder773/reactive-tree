import type { AsyncExecutor } from '../types/runtime'
import type { Store } from '../types/store'

export type LoadingStatus = 'idle' | 'loading' | 'error'

export class LoadingService {
	constructor(
		private readonly store: Store<LoadingStatus>,
		private readonly executeAsync: AsyncExecutor,
	) {}

	async run<T>(callback: () => T | Promise<T>, key?: string): Promise<T> {
		this.store.set('loading', key)

		try {
			const result = await this.executeAsync('callback', callback)
			this.store.set('idle', key)
			return result
		} catch (error) {
			this.store.set('error', key)
			throw error
		}
	}

	get(key?: string): LoadingStatus {
		return this.store.get(key) ?? 'idle'
	}
}
