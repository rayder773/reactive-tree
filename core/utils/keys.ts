import { DEFAULT_STORE_KEY, type StoreKey } from '../types/store'

export function normalizeStoreKey(key?: StoreKey): string {
	if (key === undefined) {
		return DEFAULT_STORE_KEY
	}

	if (typeof key === 'string') {
		return key
	}

	return [...key].sort().join('|')
}
