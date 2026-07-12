import type { UiFactoryOptions, UiNodeBase, UiNodeFactory } from './nodeTypes'

export function createNodeFactory<TNode extends UiNodeBase, TOptions>(
	options: UiFactoryOptions,
	createNode: (input: TOptions, nextId: () => string) => TNode,
): UiNodeFactory<TNode, TOptions> {
	const nodes = new Map<string, TNode>()
	let nextNodeId = 1

	const nextId = () => `${options.name}.${nextNodeId++}`
	const factory = ((input: TOptions): TNode => {
		const node = createNode(input, nextId)
		nodes.set(node.id, node)
		return node
	}) as UiNodeFactory<TNode, TOptions>

	factory.get = (id: string) => nodes.get(id)
	factory.values = () => [...nodes.values()]
	factory.delete = (id: string) => nodes.delete(id)
	factory.clear = () => nodes.clear()

	return factory
}
