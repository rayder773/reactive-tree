import type {
	AsyncEventContext,
	MethodErrorEventContext,
	MethodEventContext,
	MethodResultEventContext,
	RegistrationEventContext,
	RuntimeEventContext,
	RuntimePlugin,
	StoreEventContext,
} from '../types/lifecycle'

export interface DependencyGraphNode {
	id: number
	label: string
	kind: 'registration' | 'method' | 'async' | 'store'
	parentId?: number
}

export interface DependencyGraphEdge {
	from: number
	to: number
}

export interface DependencyGraphSnapshot {
	nodes: readonly DependencyGraphNode[]
	edges: readonly DependencyGraphEdge[]
}

export interface DependencyGraphPlugin extends RuntimePlugin {
	getSnapshot(): DependencyGraphSnapshot
	print(): void
}

export function dependencyGraphPlugin(): DependencyGraphPlugin {
	const nodes: DependencyGraphNode[] = []
	const edges: DependencyGraphEdge[] = []
	const stack: number[] = []
	let nextId = 1

	const addNode = (
		label: string,
		kind: DependencyGraphNode['kind'],
	): DependencyGraphNode => {
		const parentId = stack.at(-1)
		const node =
			parentId === undefined
				? { id: nextId, label, kind }
				: { id: nextId, label, kind, parentId }

		nextId += 1
		nodes.push(node)

		if (parentId !== undefined) {
			edges.push({ from: parentId, to: node.id })
		}

		return node
	}

	const popNode = (label: string) => {
		const nodeId = stack.pop()

		if (nodeId === undefined) {
			return
		}

		const node = nodes.find((candidate) => candidate.id === nodeId)

		if (node?.label !== label) {
			const expected = node?.label ?? 'empty stack'
			console.warn(
				`[dependency-graph] stack mismatch: expected ${expected}, received ${label}`,
			)
		}
	}

	const print = () => {
		console.group('[dependency-graph]')

		for (const node of nodes) {
			const depth = getDepth(node, nodes)
			console.log(`${'  '.repeat(depth)}${node.label}`)
		}

		console.groupEnd()
	}

	return {
		name: 'DependencyGraphPlugin',
		runtimeCreated(_context: RuntimeEventContext) {
			console.log('[dependency-graph] runtime created')
		},
		runtimeDisposed(_context: RuntimeEventContext) {
			console.log('[dependency-graph] runtime disposed')
			print()
		},
		afterRegister(context: RegistrationEventContext) {
			const node = addNode(`register ${context.name}`, 'registration')
			console.log(`[dependency-graph] registered ${context.name}`)
			nodes.splice(nodes.indexOf(node), 1, { ...node })
		},
		beforeMethod(context: MethodEventContext) {
			const label = `${context.name}.${context.method}`
			const node = addNode(label, 'method')
			stack.push(node.id)
			console.log(`[dependency-graph] → ${label}`)
		},
		afterMethod(context: MethodResultEventContext) {
			const label = `${context.name}.${context.method}`
			popNode(label)
			console.log(`[dependency-graph] ← ${label}`)
		},
		methodError(context: MethodErrorEventContext) {
			const label = `${context.name}.${context.method}`
			popNode(label)
			console.log(`[dependency-graph] ! ${label}`, context.error)
		},
		beforeStoreGet(context: StoreEventContext) {
			const label = `Store.${context.method}(${context.normalizedKey})`
			const node = addNode(label, 'store')
			stack.push(node.id)
			console.log(`[dependency-graph] → ${label}`)
		},
		afterStoreGet(context: StoreEventContext) {
			const label = `Store.${context.method}(${context.normalizedKey})`
			popNode(label)
			console.log(`[dependency-graph] ← ${label}`)
		},
		beforeStoreSet(context: StoreEventContext) {
			const label = `Store.set(${context.normalizedKey})`
			const node = addNode(label, 'store')
			stack.push(node.id)
			console.log(`[dependency-graph] → ${label}`)
		},
		afterStoreSet(context: StoreEventContext) {
			const label = `Store.set(${context.normalizedKey})`
			popNode(label)
			console.log(`[dependency-graph] ← ${label}`)
		},
		beforeStoreDelete(context: StoreEventContext) {
			const label = `Store.delete(${context.normalizedKey})`
			const node = addNode(label, 'store')
			stack.push(node.id)
			console.log(`[dependency-graph] → ${label}`)
		},
		afterStoreDelete(context: StoreEventContext) {
			const label = `Store.delete(${context.normalizedKey})`
			popNode(label)
			console.log(`[dependency-graph] ← ${label}`)
		},
		beforeStoreClear(_context: StoreEventContext) {
			const label = 'Store.clear'
			const node = addNode(label, 'store')
			stack.push(node.id)
			console.log(`[dependency-graph] → ${label}`)
		},
		afterStoreClear(_context: StoreEventContext) {
			const label = 'Store.clear'
			popNode(label)
			console.log(`[dependency-graph] ← ${label}`)
		},
		beforeAsync(context: AsyncEventContext) {
			const node = addNode(context.label, 'async')
			stack.push(node.id)
			console.log(`[dependency-graph] → ${context.label}`)
		},
		afterAsync(context: AsyncEventContext) {
			popNode(context.label)
			console.log(`[dependency-graph] ← ${context.label}`)
		},
		getSnapshot() {
			return {
				nodes: nodes.map((node) => ({ ...node })),
				edges: edges.map((edge) => ({ ...edge })),
			}
		},
		print,
	}
}

function getDepth(
	node: DependencyGraphNode,
	nodes: readonly DependencyGraphNode[],
): number {
	let depth = 0
	let parentId = node.parentId

	while (parentId !== undefined) {
		depth += 1
		parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId
	}

	return depth
}
