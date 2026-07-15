import type { StoreKey } from './store'

export interface StoreEventContext {
	store: object
	method: 'get' | 'set' | 'delete' | 'has' | 'clear'
	key: StoreKey | undefined
	normalizedKey: string
	value?: unknown
	result?: unknown
}

export interface RuntimePlugin {
	name: string
	beforeStoreGet?(context: StoreEventContext): void
	afterStoreGet?(context: StoreEventContext): void
	beforeStoreSet?(context: StoreEventContext): void
	afterStoreSet?(context: StoreEventContext): void
	beforeStoreDelete?(context: StoreEventContext): void
	afterStoreDelete?(context: StoreEventContext): void
	beforeStoreClear?(context: StoreEventContext): void
	afterStoreClear?(context: StoreEventContext): void
}
