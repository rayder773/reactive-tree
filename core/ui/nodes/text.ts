import type { ReactivityApi } from '../../reactivity'
import { createNodeFactory } from './createNodeFactory'
import {
	createCommonNodeProps,
	type TextNode,
	type TextOptions,
	type UiFactoryOptions,
	type UiNodeFactory,
} from './nodeTypes'

export type TextUtility = UiNodeFactory<TextNode, TextOptions>

export function createTextUtility(
	reactivity: ReactivityApi,
	options: UiFactoryOptions,
): TextUtility {
	return createNodeFactory(options, (input, nextId) => ({
		...createCommonNodeProps('text', input, reactivity, nextId),
		type: 'text',
		value: reactivity.toComputed(input.value),
	}))
}
