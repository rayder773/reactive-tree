import type { Store } from '../types/store'

export interface PaginationState {
	page: number
	pageSize: number
}

export class PaginationService {
	constructor(private readonly store: Store<PaginationState>) {}

	get(key?: string): PaginationState {
		return this.store.get(key) ?? { page: 1, pageSize: 20 }
	}

	setPage(page: number, key?: string): PaginationState {
		const current = this.get(key)
		const next = { ...current, page }
		this.store.set(next, key)
		return next
	}

	setPageSize(pageSize: number, key?: string): PaginationState {
		const current = this.get(key)
		const next = { ...current, page: 1, pageSize }
		this.store.set(next, key)
		return next
	}
}
