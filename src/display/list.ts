import { computed as vueComputed } from 'vue'
import type { AnyNode, BuildContext, NodeSpec, StateNode } from '../types'
import { state } from '../nodes/state'
import { childPath, emptyDiagnosticsRefs, registerDebugNode } from '../nodes/utils'
import type { TableColumn, TableRow, TableNode } from './table'
import { table } from './table'

export interface ListColumnDef<T = unknown> {
	key: string
	header: string | (() => string)
	cell: (entity: T) => string | (() => string)
}

export interface ListRowDef<T = unknown> {
	label: (entity: T) => string | (() => string)
	sublabel?: (entity: T) => string | (() => string)
}

export interface ListVirtualizeConfig {
	windowSize: number
	rowHeight: number
	onReachEnd?: () => void
	onReachStart?: () => void
}

export interface ListTableSubConfig {
	columns: () => TableColumn[]
	rows: (id: string) => TableRow[]
}

export interface ListDisplayConfig<T = unknown> {
	// EntityListNode (or any object with .ids and .total)
	source: () => { ids: { value: string[] }; total: { value: number } }
	// Resolve entity from id using the store dict
	resolve?: (id: string) => T | undefined
	/** Groups mode:'table' and columns together. Takes precedence over mode/columns. */
	table?: ListTableSubConfig
	virtualize?: ListVirtualizeConfig
	row?: ListRowDef<T>
	/** @deprecated Use `table` sub-config instead */
	mode?: 'table' | 'list'
	/** @deprecated Use `table.columns` instead */
	columns?: ListColumnDef<T>[]
}

export interface ListRowCell {
	readonly value: string
}

export interface ListDisplayRow<T = unknown> {
	/** Stable key for v-for (window slot index as string) */
	readonly key: string
	/** Entity id at this slot, null if out of range */
	readonly id: string | null
	/** Resolved entity, null if not found */
	readonly entity: T | null
	readonly cells: Record<string, ListRowCell>
}

export interface VirtualDisplayState {
	readonly offset: StateNode<number>
	readonly windowSize: StateNode<number>
	readonly total: { readonly value: number }
	readonly rowHeight: number
	readonly onReachEnd?: () => void
	readonly onReachStart?: () => void
}

export interface ListDisplayNode<T = unknown> extends AnyNode {
	readonly kind: 'list-display'
	readonly tableNode?: TableNode
	/** Stable array of windowSize slot objects with reactive content */
	readonly rows: ListDisplayRow<T>[]
	readonly columns: ListColumnDef<T>[]
	readonly mode: 'table' | 'list'
	readonly virtual: VirtualDisplayState | undefined
}

export function listDisplay<T = unknown>(
	config: ListDisplayConfig<T>,
): NodeSpec<ListDisplayNode<T>> {
	return {
		build(context: BuildContext): ListDisplayNode<T> {
			const virt = config.virtualize
			const windowSize = virt?.windowSize ?? Infinity
			const columns = config.columns ?? []

			let offsetNode: StateNode<number> | undefined
			let windowSizeNode: StateNode<number> | undefined
			let virtualState: VirtualDisplayState | undefined

			if (virt) {
				offsetNode = state<number>(0, { label: 'offset' }).build({
					...context,
					path: childPath(context.path, 'offset'),
					registerNode: undefined,
				})
				windowSizeNode = state<number>(virt.windowSize, {
					label: 'windowSize',
				}).build({
					...context,
					path: childPath(context.path, 'windowSize'),
					registerNode: undefined,
				})

				const totalRef = vueComputed(() => config.source().total.value)
				const totalNode = {
					get value() {
						return totalRef.value
					},
				}

				virtualState = {
					offset: offsetNode,
					windowSize: windowSizeNode,
					total: totalNode,
					rowHeight: virt.rowHeight,
					onReachEnd: virt.onReachEnd,
					onReachStart: virt.onReachStart,
				}
			}

			// Build stable row slot objects – their content is reactive via getters
			const slotCount = virt ? virt.windowSize : 0

			const rows: ListDisplayRow<T>[] = Array.from(
				{ length: slotCount },
				(_, i) => {
					const idRef = vueComputed(() => {
						const ids = config.source().ids.value
						const offset = offsetNode?.value ?? 0
						return ids[offset + i] ?? null
					})

					const entityRef = vueComputed<T | null>(() => {
						const id = idRef.value
						if (!id) return null
						return config.resolve?.(id) ?? null
					})

					const cells: Record<string, ListRowCell> = {}
					for (const col of columns) {
						const colKey = col.key
						const cellRef = vueComputed(() => {
							const entity = entityRef.value
							if (!entity) return ''
							const def = col.cell(entity)
							return typeof def === 'function' ? def() : def
						})
						cells[colKey] = {
							get value() {
								return cellRef.value
							},
						}
					}

					return {
						key: String(i),
						get id() {
							return idRef.value
						},
						get entity() {
							return entityRef.value
						},
						cells,
					}
				},
			)

			// Build table node if config.table is provided
			let builtTableNode: TableNode | undefined

			if (config.table) {
				const tableConfig = config.table
				const tableSpec = table({
					columns: tableConfig.columns,
					rows: () => {
						const ids = config.source().ids.value
						const slice = virt
							? ids.slice(offsetNode!.value, offsetNode!.value + virt.windowSize)
							: ids
						return slice.flatMap(id => tableConfig.rows(id))
					},
				})
				builtTableNode = tableSpec.build({
					...context,
					path: childPath(context.path, 'table'),
					registerNode: undefined,
				})
			}

			const node: any = {
				kind: 'list-display' as const,
				id: undefined,
				label: undefined,
				metadata: undefined,
				checks: [],
				get value() {
					return config.source().ids.value
				},
				tableNode: builtTableNode,
				rows,
				columns,
				mode: config.table ? 'table' : (config.mode ?? 'list'),
				virtual: virtualState,
			}

			registerDebugNode(context, node, 'list-display', true, (config as any).__source)
			Object.assign(node, emptyDiagnosticsRefs)

			Object.defineProperty(node, '__displayDebug', {
				value: context.debug,
				enumerable: false,
			})

			context.registerNode?.(node)

			return node as ListDisplayNode<T>
		},
	}
}
