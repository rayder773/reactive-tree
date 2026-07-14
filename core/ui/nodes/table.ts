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
		columns: options.columns,
		resolve: createResolveCache((ctx) => ({
			rows: resolveContextualFn(reactivity, options.rows, ctx),
			isVisible: resolveContextualFn(
				reactivity,
				options.isVisible ?? true,
				ctx,
			),
		})),
	}
}
