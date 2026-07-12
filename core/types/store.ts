export const DEFAULT_STORE_KEY = '__DEFAULT__'

export type StoreKey = string | readonly string[]

export interface Store<T> {
	get(key?: StoreKey): T | undefined
	set(value: T, key?: StoreKey): void
	delete(key?: StoreKey): boolean
	has(key?: StoreKey): boolean
	clear(): void
}
