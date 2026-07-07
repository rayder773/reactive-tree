import { computed as vueComputed } from 'vue'
import type { SourceLocation } from '../debug'
import {
	childPath,
	emptyDiagnosticsRefs,
	registerDebugNode,
} from '../nodes/utils'
import type { AnyNode, BuildContext, NodeSpec } from '../types'

export interface TableColumn {
	id: string
	text: string | (() => string)
}

export interface TableRow {
	id: string
	text: string | (() => string)
}

export interface DynamicRowDebug {
	sourceLocation?: SourceLocation
	mapperLocation?: SourceLocation
}

export interface TableConfig {
	columns: () => TableColumn[]
	rows: () => TableRow[]
}

export interface TableCellNode extends AnyNode {
	readonly kind: 'computed'
	readonly value: string
}

export interface TableNode extends AnyNode {
	readonly kind: 'table'
	readonly columns: { value: TableColumn[] }
	readonly rows: { value: TableRow[] }
	columnNode(id: string): TableCellNode | undefined
	rowNode(id: string): TableCellNode | undefined
}

function resolveText(v: string | (() => string)): string {
	return typeof v === 'function' ? v() : v
}

function dynamicRowDebug(row: TableRow): DynamicRowDebug | undefined {
	return (row as any).__dynamicRow
}

export function dynamicRows<T>(
	items: () => readonly T[],
	mapper: (item: T, index: number) => TableRow,
): TableRow[] {
	const sourceLocation = (items as any).__source as SourceLocation | undefined
	const mapperLocation = (mapper as any).__source as SourceLocation | undefined

	return items().map((item, index) => {
		const row = mapper(item, index)
		Object.defineProperty(row, '__dynamicRow', {
			enumerable: false,
			configurable: true,
			value: { sourceLocation, mapperLocation } satisfies DynamicRowDebug,
		})
		return row
	})
}

export function table(config: TableConfig): NodeSpec<TableNode> {
	return {
		build(context: BuildContext): TableNode {
			const node: any = { kind: 'table' as const }
			const tableSource = (config as any).__source
			node.dataRoot = context.data

			registerDebugNode(context, node, 'table', true, (config as any).__source)
			Object.defineProperty(node, '__displayDebug', {
				value: context.debug,
				enumerable: false,
			})
			Object.assign(node, emptyDiagnosticsRefs)

			const columnsPath = childPath(context.path, 'columns')
			const columnsRef = vueComputed(() =>
				context.debug.runWithReader(
					{ readerId: columnsPath, reason: 'computed' },
					config.columns,
				),
			)
			const columnsNode: any = {
				kind: 'computed',
				get value() {
					return columnsRef.value
				},
			}
			context.debug.registerNode(columnsNode, {
				id: columnsPath,
				path: columnsPath,
				kind: 'computed',
				active: true,
			})
			Object.assign(columnsNode, emptyDiagnosticsRefs)
			node.columns = columnsNode

			const rowsPath = childPath(context.path, 'rows')
			const rowsRef = vueComputed(() =>
				context.debug.runWithReader(
					{ readerId: rowsPath, reason: 'computed' },
					config.rows,
				),
			)
			const rowsNode: any = {
				kind: 'computed',
				get value() {
					return rowsRef.value
				},
			}
			context.debug.registerNode(rowsNode, {
				id: rowsPath,
				path: rowsPath,
				kind: 'computed',
				active: true,
			})
			Object.assign(rowsNode, emptyDiagnosticsRefs)
			node.rows = rowsNode

			const columnNodeCache = new Map<string, TableCellNode>()
			const rowNodeCache = new Map<string, TableCellNode>()

			node.columnNode = (id: string): TableCellNode | undefined => {
				const col = columnsRef.value.find((c) => c.id === id)
				if (!col) return undefined
				if (columnNodeCache.has(id)) return columnNodeCache.get(id)!

				const cellPath = childPath(columnsPath, id)
				const textI18nSource =
					typeof col.text === 'function'
						? ((col.text as any).__textSource ?? (col.text as any).__i18nSource)
						: undefined
				const cellRef = vueComputed(() =>
					context.debug.runWithReader(
						{ readerId: cellPath, reason: 'computed' },
						() =>
							resolveText(
								config.columns().find((c) => c.id === id)?.text ?? '',
							),
					),
				)
				const cellNode: any = {
					kind: 'computed',
					dataRoot: context.data,
					get value() {
						return cellRef.value
					},
				}
				context.debug.registerNode(cellNode, {
					id: cellPath,
					path: cellPath,
					kind: 'computed',
					active: true,
				})
				Object.defineProperty(cellNode, '__displayDebug', {
					value: context.debug,
					enumerable: false,
				})
				Object.defineProperty(cellNode, '__domBindings', {
					enumerable: false,
					value: [
						{
							prop: 'textContent',
							sourceNode: null,
							readerNodeId: cellPath,
							tag: 'display',
							editable: false,
							sourceLocation: textI18nSource ?? tableSource,
						},
					],
				})
				Object.assign(cellNode, emptyDiagnosticsRefs)
				columnNodeCache.set(id, cellNode)
				return cellNode
			}

			node.rowNode = (id: string): TableCellNode | undefined => {
				const row = rowsRef.value.find((r) => r.id === id)
				if (!row) return undefined
				if (rowNodeCache.has(id)) return rowNodeCache.get(id)!

				const cellPath = childPath(rowsPath, id)
				const textI18nSource =
					typeof row.text === 'function'
						? ((row.text as any).__textSource ?? (row.text as any).__i18nSource)
						: undefined
				const rowDebug = dynamicRowDebug(row)
				const cellRef = vueComputed(() =>
					context.debug.runWithReader(
						{ readerId: cellPath, reason: 'computed' },
						() =>
							resolveText(config.rows().find((r) => r.id === id)?.text ?? ''),
					),
				)
				const cellNode: any = {
					kind: 'computed',
					dataRoot: context.data,
					get value() {
						return cellRef.value
					},
				}
				context.debug.registerNode(cellNode, {
					id: cellPath,
					path: cellPath,
					kind: 'computed',
					active: true,
				})
				Object.defineProperty(cellNode, '__displayDebug', {
					value: context.debug,
					enumerable: false,
				})
				Object.defineProperty(cellNode, '__domBindings', {
					enumerable: false,
					value: [
						{
							prop: 'textContent',
							sourceNode: null,
							readerNodeId: cellPath,
							tag: 'display',
							editable: false,
							sourceLocation:
								textI18nSource ??
								rowDebug?.mapperLocation ??
								rowDebug?.sourceLocation ??
								tableSource,
						},
					],
				})
				Object.assign(cellNode, emptyDiagnosticsRefs)
				rowNodeCache.set(id, cellNode)
				return cellNode
			}

			context.registerNode?.(node)

			return node as TableNode
		},
	}
}
