import type { ReactivityApi } from '../../reactivity'
import {
	createResolveCache,
	resolveContextualFn,
	type TableNode,
	type TableOptions,
} from './nodeTypes'

export function createTableNode<TRow>(
	reactivity: ReactivityApi,
	id: string,
	options: TableOptions<TRow>,
): TableNode<TRow> {
	return {
		id,
		type: 'table',
		rowContext: options.rowContext,
		columnContext: options.columnContext,
		getRowKey: options.rowKey
			? (row, _i) => options.rowKey!(row as TRow)
			: defaultGetRowKey,
		resolve: createResolveCache((ctx) => ({
			rows: resolveContextualFn(reactivity, options.rows, ctx),
			columns: resolveContextualFn(reactivity, options.columns, ctx),
			isVisible: resolveContextualFn(
				reactivity,
				options.isVisible ?? true,
				ctx,
			),
		})),
	}
}

function defaultGetRowKey(row: unknown, index: number): string {
	if (
		typeof row === 'object' &&
		row !== null &&
		'id' in row &&
		typeof (row as Record<string, unknown>).id === 'string'
	) {
		return (row as Record<string, unknown>).id as string
	}
	return String(index)
}
