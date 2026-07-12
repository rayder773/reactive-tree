import type { Store, StoreKey } from '../types/store'

export interface PaginationState {
	page: number
	pageSize: number
	total: number
}

export class PaginationService {
	constructor(private readonly store: Store<PaginationState>) {}

	get(key?: StoreKey): PaginationState {
		return this.store.get(key) ?? { page: 1, pageSize: 20, total: 0 }
	}

	setPage(page: number, key?: StoreKey): PaginationState {
		const current = this.get(key)
		const next = { ...current, page }
		this.store.set(next, key)
		return next
	}

	setPageSize(pageSize: number, key?: StoreKey): PaginationState {
		const current = this.get(key)
		const next = { ...current, page: 1, pageSize }
		this.store.set(next, key)
		return next
	}

	setTotal(total: number, key?: StoreKey): PaginationState {
		const current = this.get(key)
		const next = { ...current, total }
		this.store.set(next, key)
		return next
	}

	delete(key?: StoreKey): void {
		this.store.delete(key)
	}

	clear(): void {
		this.store.clear()
	}
}
