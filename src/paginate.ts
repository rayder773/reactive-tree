export type PaginationMode = 'page' | 'cursor'

export interface PagePaginationConfig {
	pageSize?: number
	fields?: {
		request?: { page?: string; pageSize?: string }
		response?: { total?: string }
	}
}

export interface CursorPaginationConfig {
	fields?: {
		request?: { cursor?: string }
		response?: { nextCursor?: string; hasMore?: string }
	}
}

export interface PagePaginationSpec {
	readonly _type: 'page'
	readonly pageSize: number
	readonly reqPage: string
	readonly reqPageSize: string
	readonly resTotal: string
}

export interface CursorPaginationSpec {
	readonly _type: 'cursor'
	readonly reqCursor: string
	readonly resNextCursor: string
	readonly resHasMore: string
}

export type PaginationSpec = PagePaginationSpec | CursorPaginationSpec

export function paginate(type: 'page', config?: PagePaginationConfig): PagePaginationSpec
export function paginate(type: 'cursor', config?: CursorPaginationConfig): CursorPaginationSpec
export function paginate(type: PaginationMode, config: any = {}): PaginationSpec {
	if (type === 'page') {
		const c = config as PagePaginationConfig
		return {
			_type: 'page',
			pageSize: c.pageSize ?? 50,
			reqPage: c.fields?.request?.page ?? 'page',
			reqPageSize: c.fields?.request?.pageSize ?? 'pageSize',
			resTotal: c.fields?.response?.total ?? 'total',
		}
	}
	const c = config as CursorPaginationConfig
	return {
		_type: 'cursor',
		reqCursor: c.fields?.request?.cursor ?? 'cursor',
		resNextCursor: c.fields?.response?.nextCursor ?? 'nextCursor',
		resHasMore: c.fields?.response?.hasMore ?? 'hasMore',
	}
}
