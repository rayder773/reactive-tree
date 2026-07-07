import { createTree, state } from '../../../../../src'

export const counter = createTree({
	count: state(0, { label: 'Count' }),
})
