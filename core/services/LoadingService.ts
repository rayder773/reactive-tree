import type { Store, StoreKey } from '../types/store'

export type LoadingStatus = 'idle' | 'loading' | 'error'

export class LoadingService {
	constructor(private readonly store: Store<LoadingStatus>) {}

	async run<T>(callback: () => T | Promise<T>, key?: StoreKey): Promise<T> {
		this.store.set('loading', key)

		try {
			const result = await callback()
			this.store.set('idle', key)
			return result
		} catch (error) {
			this.store.set('error', key)
			throw error
		}
	}

	get(key?: StoreKey): LoadingStatus {
		return this.store.get(key) ?? 'idle'
	}
}
