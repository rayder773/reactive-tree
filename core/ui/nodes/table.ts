import type { ReactivityApi } from '../../reactivity'
import { createNodeFactory } from './createNodeFactory'
import {
	createCommonNodeProps,
	type TableNode,
	type TableOptions,
	type UiFactoryOptions,
	type UiNodeFactory,
} from './nodeTypes'

export function createTableUtility(
	reactivity: ReactivityApi,
	options: UiFactoryOptions,
): UiNodeFactory<TableNode<unknown>, TableOptions<unknown>> {
	return createNodeFactory(options, (input, nextId) => ({
		...createCommonNodeProps('table', input, reactivity, nextId),
		type: 'table',
		rows: reactivity.toComputed(input.rows),
		columns: input.columns,
	}))
}
