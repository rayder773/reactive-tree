import type { ReactivityApi } from '../../reactivity'
import { createNodeFactory } from './createNodeFactory'
import {
	type ButtonNode,
	type ButtonOptions,
	createCommonNodeProps,
	type UiFactoryOptions,
	type UiNodeFactory,
} from './nodeTypes'

export type ButtonUtility = UiNodeFactory<ButtonNode, ButtonOptions>

export function createButtonUtility(
	reactivity: ReactivityApi,
	options: UiFactoryOptions,
): ButtonUtility {
	return createNodeFactory(options, (input, nextId) => ({
		...createCommonNodeProps('button', input, reactivity, nextId),
		type: 'button',
		text: reactivity.toComputed(input.text),
		disabled: reactivity.toComputed(input.disabled ?? false),
		onClick: input.onClick ?? (() => undefined),
	}))
}
