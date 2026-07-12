import type { Store as StoreContract, StoreKey } from '../types/store'
import { normalizeStoreKey } from '../utils/keys'

export class Store<T> implements StoreContract<T> {
	private readonly records = new Map<string, T>()

	get(key?: StoreKey): T | undefined {
		return this.records.get(normalizeStoreKey(key))
	}

	set(value: T, key?: StoreKey): void {
		this.records.set(normalizeStoreKey(key), value)
	}

	delete(key?: StoreKey): boolean {
		return this.records.delete(normalizeStoreKey(key))
	}

	has(key?: StoreKey): boolean {
		return this.records.has(normalizeStoreKey(key))
	}

	clear(): void {
		this.records.clear()
	}
}
