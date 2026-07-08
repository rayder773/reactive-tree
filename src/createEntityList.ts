import { computed as vueComputed, watchEffect } from 'vue'
import { section } from './nodes/section'
import { state } from './nodes/state'
import type {
	AnyNode,
	AsyncNode,
	BuildContext,
	ComputedNode,
	NodeSpec,
	SectionChildren,
	StateNode,
} from './types'
import { childPath, emptyDiagnosticsRefs, registerDebugNode } from './nodes/utils'
import type {
	CursorPaginationSpec,
	PagePaginationSpec,
	PaginationSpec,
} from './paginate'
import type { EntityStoreNode } from './createEntityStore'

export type FetchMode = 'replace' | 'append'

export interface EntityListSortingConfig {
	by?: NodeSpec<StateNode<string>>
	dir?: NodeSpec<StateNode<'asc' | 'desc'>>
	defaultBy?: string
	defaultDir?: 'asc' | 'desc'
}

export interface EntityListStateConfig<TFilters extends SectionChildren> {
	filters: TFilters
	sorting?: EntityListSortingConfig
	pagination?: PaginationSpec
}

type StoresConfig = Record<string, NodeSpec<EntityStoreNode<any>>>

type BuiltStores<TStores extends StoresConfig> = {
	[K in keyof TStores]: TStores[K] extends NodeSpec<infer T> ? T : never
}

export interface EntityListConfig<
	TResult,
	TFilters extends SectionChildren,
	TStores extends StoresConfig = Record<never, never>
> {
	listState: EntityListStateConfig<TFilters>
	trigger?: (self: EntityListNode<TFilters>) => Record<string, unknown> | null
	fetch: NodeSpec<AsyncNode<TResult, Record<string, unknown>>>
	stores?: TStores
	onFetch: (result: TResult, self: EntityListNode<TFilters>, stores: BuiltStores<TStores>) => string[]
	fetchMode?: FetchMode
}

interface PagePaginationBuilt {
	_type: 'page'
	page: StateNode<number>
	pageSize: StateNode<number>
	total: StateNode<number>
	hasMore: ComputedNode<boolean>
}

interface CursorPaginationBuilt {
	_type: 'cursor'
	cursor: StateNode<string | null>
	nextCursor: StateNode<string | null>
	hasMore: StateNode<boolean>
}

type BuiltPagination = PagePaginationBuilt | CursorPaginationBuilt

export interface EntityListNode<TFilters extends SectionChildren = SectionChildren>
	extends AnyNode {
	readonly kind: 'entity-list'
	readonly listState: {
		filters: any
		sorting: { by: StateNode<string> & Record<string, any>; dir: StateNode<'asc' | 'desc'> & Record<string, any> }
		pagination: BuiltPagination | null
	}
	readonly fetch: AsyncNode<unknown, Record<string, unknown>>
	readonly ids: StateNode<string[]>
	readonly total: ComputedNode<number>
	nextPage(): void
	prevPage(): void
	reset(): void
	[key: string]: any
}

function buildPagination(
	spec: PaginationSpec,
	context: BuildContext,
	basePath: string,
): BuiltPagination {
	if (spec._type === 'page') {
		const page = state<number>(0, { label: 'page' }).build({
			...context,
			path: childPath(basePath, 'page'),
			registerNode: undefined,
		})
		const pageSize = state<number>(spec.pageSize, { label: 'pageSize' }).build({
			...context,
			path: childPath(basePath, 'pageSize'),
			registerNode: undefined,
		})
		const total = state<number>(0, { label: 'total' }).build({
			...context,
			path: childPath(basePath, 'total'),
			registerNode: undefined,
		})
		const hasMoreRef = vueComputed(
			() => (page.value + 1) * pageSize.value < total.value,
		)
		const hasMore: any = {
			kind: 'computed',
			get value() {
				return hasMoreRef.value
			},
		}
		Object.assign(hasMore, emptyDiagnosticsRefs)
		return { _type: 'page', page, pageSize, total, hasMore }
	}

	const cursor = state<string | null>(null, { label: 'cursor' }).build({
		...context,
		path: childPath(basePath, 'cursor'),
		registerNode: undefined,
	})
	const nextCursor = state<string | null>(null, { label: 'nextCursor' }).build({
		...context,
		path: childPath(basePath, 'nextCursor'),
		registerNode: undefined,
	})
	const hasMore = state<boolean>(true, { label: 'hasMore' }).build({
		...context,
		path: childPath(basePath, 'hasMore'),
		registerNode: undefined,
	})
	return { _type: 'cursor', cursor, nextCursor, hasMore }
}

function getPaginationRequestParams(
	built: BuiltPagination,
	spec: PaginationSpec,
): Record<string, unknown> {
	if (built._type === 'page' && spec._type === 'page') {
		return {
			[spec.reqPage]: built.page.value,
			[spec.reqPageSize]: built.pageSize.value,
		}
	}
	if (built._type === 'cursor' && spec._type === 'cursor') {
		return { [spec.reqCursor]: built.cursor.value }
	}
	return {}
}

function updatePaginationFromResponse(
	built: BuiltPagination,
	spec: PaginationSpec,
	response: Record<string, unknown>,
): void {
	if (built._type === 'page' && spec._type === 'page') {
		const total = response[(spec as PagePaginationSpec).resTotal]
		if (typeof total === 'number') built.total.set(total)
	} else if (built._type === 'cursor' && spec._type === 'cursor') {
		const ps = spec as CursorPaginationSpec
		const nextCursor = response[ps.resNextCursor]
		const hasMore = response[ps.resHasMore]
		built.nextCursor.set(typeof nextCursor === 'string' ? nextCursor : null)
		if (typeof hasMore === 'boolean') built.hasMore.set(hasMore)
	}
}

function resetPagination(built: BuiltPagination): void {
	if (built._type === 'page') {
		built.page.set(0)
		built.total.set(0)
	} else {
		built.cursor.set(null)
		built.nextCursor.set(null)
		built.hasMore.set(true)
	}
}

export function createEntityList<
	TResult,
	TFilters extends SectionChildren,
	TStores extends StoresConfig = Record<never, never>
>(
	config: EntityListConfig<TResult, TFilters, TStores>,
): NodeSpec<EntityListNode<TFilters>> {
	return {
		build(context: BuildContext): EntityListNode<TFilters> {
			const listStatePath = childPath(context.path, 'listState')
			const paginSpec = config.listState.pagination ?? null

			const builtFilters = section(config.listState.filters).build({
				...context,
				path: childPath(listStatePath, 'filters'),
				registerNode: undefined,
			})

			const sortingPath = childPath(listStatePath, 'sorting')
			const sortingBy = (config.listState.sorting?.by ?? state<string>(config.listState.sorting?.defaultBy ?? '', { label: 'sortBy' })).build({
				...context,
				path: childPath(sortingPath, 'by'),
				registerNode: undefined,
			})
			const sortingDir = (config.listState.sorting?.dir ?? state<'asc' | 'desc'>(config.listState.sorting?.defaultDir ?? 'asc', { label: 'sortDir' })).build({
				...context,
				path: childPath(sortingPath, 'dir'),
				registerNode: undefined,
			})

			const builtPagination: BuiltPagination | null = paginSpec
				? buildPagination(
						paginSpec,
						context,
						childPath(listStatePath, 'pagination'),
					)
				: null

			const idsNode = state<string[]>([], { label: 'ids' }).build({
				...context,
				path: childPath(context.path, 'ids'),
				registerNode: undefined,
			})

			const fetchNode = config.fetch.build({
				...context,
				path: childPath(context.path, 'fetch'),
				registerNode: undefined,
			})

			const totalRef = vueComputed(() => {
				if (builtPagination?._type === 'page') return builtPagination.total.value
				return idsNode.value.length
			})
			const totalNode: any = {
				kind: 'computed',
				get value() {
					return totalRef.value
				},
			}
			Object.assign(totalNode, emptyDiagnosticsRefs)

			const listStateObj = {
				filters: builtFilters,
				sorting: { by: sortingBy, dir: sortingDir },
				pagination: builtPagination,
			}

			let shouldAppend = false

			const node: any = {
				kind: 'entity-list' as const,
				id: undefined,
				label: undefined,
				metadata: undefined,
				checks: [],
				get value() {
					return idsNode.value
				},
				listState: listStateObj,
				fetch: fetchNode,
				ids: idsNode,
				total: totalNode,
				nextPage() {
					shouldAppend = config.fetchMode === 'append'
					if (builtPagination?._type === 'page') {
						builtPagination.page.set(builtPagination.page.value + 1)
					} else if (builtPagination?._type === 'cursor') {
						builtPagination.cursor.set(builtPagination.nextCursor.value)
					}
				},
				prevPage() {
					if (builtPagination?._type === 'page') {
						builtPagination.page.set(Math.max(0, builtPagination.page.value - 1))
					}
				},
				reset() {
					shouldAppend = false
					idsNode.set([])
					if (builtPagination) resetPagination(builtPagination)
				},
			}

			registerDebugNode(context, node, 'entity-list')
			Object.assign(node, emptyDiagnosticsRefs)
			context.registerNode?.(node)

			// Build stores and assign to node
			const builtStores: Record<string, EntityStoreNode<any>> = {}
			for (const [key, storeSpec] of Object.entries(config.stores ?? {})) {
				const storeNode = (storeSpec as NodeSpec<EntityStoreNode<any>>).build({
					...context,
					path: childPath(context.path, key),
					registerNode: undefined,
				})
				builtStores[key] = storeNode
				;(node as any)[key] = storeNode
			}

			// Trigger watchEffect: reads all deps, calls fetchNode.call()
			watchEffect(
				() => {
					const userParams = config.trigger
						? context.debug.runWithReader(
								{
									readerId: childPath(context.path, 'fetch'),
									reason: 'async.trigger',
								},
								() => config.trigger!(node),
							)
						: {}

					if (userParams === null) return

					const paginParams =
						builtPagination && paginSpec
							? getPaginationRequestParams(builtPagination, paginSpec)
							: {}

					fetchNode.call({
						...userParams,
						...paginParams,
						sortBy: sortingBy.value,
						sortDir: sortingDir.value,
					})
				},
				{ flush: 'sync' },
			)

			// Result watchEffect: when fetch succeeds, update ids + pagination
			watchEffect(() => {
				if (fetchNode.status !== 'success' || fetchNode.value == null) return

				const newIds = config.onFetch(
					fetchNode.value as TResult,
					node,
					builtStores as BuiltStores<TStores>,
				)

				if (builtPagination && paginSpec) {
					updatePaginationFromResponse(
						builtPagination,
						paginSpec,
						fetchNode.value as Record<string, unknown>,
					)
				}

				if (config.fetchMode === 'append' && shouldAppend) {
					idsNode.set([...idsNode.value, ...newIds])
				} else {
					idsNode.set(newIds)
				}
				shouldAppend = false
			})

			return node as EntityListNode<TFilters>
		},
	}
}
