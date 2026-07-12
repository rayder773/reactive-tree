import type {
	AsyncEventContext,
	CustomEventContext,
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
	key: string
	label: string
	kind: 'object' | 'method' | 'async' | 'store'
	count: number
}

export interface DependencyGraphEdge {
	from: number
	to: number
	count: number
	type?: string
}

export interface DependencyGraphSnapshot {
	nodes: readonly DependencyGraphNode[]
	edges: readonly DependencyGraphEdge[]
}

export interface DependencyGraphPluginOptions {
	trace?: boolean
	printOnDispose?: boolean
}

export interface DependencyGraphPlugin extends RuntimePlugin {
	getSnapshot(): DependencyGraphSnapshot
	print(): void
}

export function dependencyGraphPlugin(
	options: DependencyGraphPluginOptions = {},
): DependencyGraphPlugin {
	const nodesByKey = new Map<string, DependencyGraphNode>()
	const edgesByKey = new Map<string, DependencyGraphEdge>()
	const objectNames = new WeakMap<object, string>()
	const stack: number[] = []
	let nextId = 1
	const trace = options.trace ?? false
	const printOnDispose = options.printOnDispose ?? false

	const enterNode = (
		label: string,
		kind: DependencyGraphNode['kind'],
	): DependencyGraphNode => {
		const node = recordNode(label, kind)
		const parentId = stack.at(-1)

		if (parentId !== undefined) {
			addEdge(parentId, node.id)
		}

		stack.push(node.id)
		return node
	}

	const addNode = (label: string, kind: DependencyGraphNode['kind']): void => {
		ensureNode(label, kind)
	}

	const popNode = (label: string) => {
		const nodeId = stack.pop()

		if (nodeId === undefined) {
			return
		}

		const node = getNodes().find((candidate) => candidate.id === nodeId)

		if (node?.label !== label) {
			const expected = node?.label ?? 'empty stack'
			console.warn(
				`[dependency-graph] stack mismatch: expected ${expected}, received ${label}`,
			)
		}
	}

	const print = () => {
		const nodes = getNodes()
		const edges = getEdges()
		const incomingNodeIds = new Set(edges.map((edge) => edge.to))
		const roots = nodes.filter((node) => !incomingNodeIds.has(node.id))

		console.group('[dependency-graph]')

		for (const node of roots) {
			printNode(node, nodes, edges, 0, new Set())
		}

		console.groupEnd()
	}

	return {
		name: 'DependencyGraphPlugin',
		runtimeCreated(_context: RuntimeEventContext) {
			logTrace('[dependency-graph] runtime created')
		},
		runtimeDisposed(_context: RuntimeEventContext) {
			logTrace('[dependency-graph] runtime disposed')

			if (printOnDispose) {
				print()
			}
		},
		afterRegister(context: RegistrationEventContext) {
			objectNames.set(context.instance, context.name)
			addNode(context.name, 'object')
			logTrace(`[dependency-graph] registered ${context.name}`)
		},
		customEvent(context: CustomEventContext) {
			if (
				context.name !== 'dependencyDeclared' ||
				!isDependencyDeclaredPayload(context.payload)
			) {
				return
			}

			const from = ensureNode(context.payload.from, 'object')
			const to = ensureNode(context.payload.to, 'object')
			addEdge(from.id, to.id, context.payload.type)
			logTrace(
				`[dependency-graph] declared ${context.payload.from} -> ${context.payload.to}`,
			)
		},
		beforeMethod(context: MethodEventContext) {
			const label = `${context.name}.${context.method}`
			enterNode(label, 'method')
			logTrace(`[dependency-graph] → ${label}`)
		},
		afterMethod(context: MethodResultEventContext) {
			const label = `${context.name}.${context.method}`
			popNode(label)
			logTrace(`[dependency-graph] ← ${label}`)
		},
		methodError(context: MethodErrorEventContext) {
			const label = `${context.name}.${context.method}`
			popNode(label)
			logTrace(`[dependency-graph] ! ${label}`, context.error)
		},
		beforeStoreGet(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			enterNode(label, 'store')
			logTrace(`[dependency-graph] → ${label}`)
		},
		afterStoreGet(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			popNode(label)
			logTrace(`[dependency-graph] ← ${label}`)
		},
		beforeStoreSet(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			enterNode(label, 'store')
			logTrace(`[dependency-graph] → ${label}`)
		},
		afterStoreSet(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			popNode(label)
			logTrace(`[dependency-graph] ← ${label}`)
		},
		beforeStoreDelete(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			enterNode(label, 'store')
			logTrace(`[dependency-graph] → ${label}`)
		},
		afterStoreDelete(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			popNode(label)
			logTrace(`[dependency-graph] ← ${label}`)
		},
		beforeStoreClear(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			enterNode(label, 'store')
			logTrace(`[dependency-graph] → ${label}`)
		},
		afterStoreClear(context: StoreEventContext) {
			const label = getStoreOperationLabel(context)
			popNode(label)
			logTrace(`[dependency-graph] ← ${label}`)
		},
		beforeAsync(context: AsyncEventContext) {
			const label = getAsyncLabel(context.label)
			enterNode(label, 'async')
			logTrace(`[dependency-graph] → ${label}`)
		},
		afterAsync(context: AsyncEventContext) {
			popAsyncNode(context.label)
			logTrace(`[dependency-graph] ← ${context.label}`)
		},
		getSnapshot() {
			return {
				nodes: getNodes().map((node) => ({ ...node })),
				edges: getEdges().map((edge) => ({ ...edge })),
			}
		},
		print,
	}

	function ensureNode(
		label: string,
		kind: DependencyGraphNode['kind'],
	): DependencyGraphNode {
		const key = `${kind}:${label}`
		const existingNode = nodesByKey.get(key)

		if (existingNode !== undefined) {
			return existingNode
		}

		const node = { id: nextId, key, label, kind, count: 0 }
		nextId += 1
		nodesByKey.set(key, node)
		return node
	}

	function recordNode(
		label: string,
		kind: DependencyGraphNode['kind'],
	): DependencyGraphNode {
		const node = ensureNode(label, kind)
		node.count += 1
		return node
	}

	function addEdge(from: number, to: number, type?: string): void {
		const key = `${from}->${to}:${type ?? ''}`
		const existingEdge = edgesByKey.get(key)

		if (existingEdge !== undefined) {
			existingEdge.count += 1
			return
		}

		const edge =
			type === undefined ? { from, to, count: 1 } : { from, to, count: 1, type }
		edgesByKey.set(key, edge)
	}

	function getNodes(): DependencyGraphNode[] {
		return [...nodesByKey.values()].sort((left, right) => left.id - right.id)
	}

	function getEdges(): DependencyGraphEdge[] {
		return [...edgesByKey.values()].sort((left, right) => {
			if (left.from !== right.from) {
				return left.from - right.from
			}

			return left.to - right.to
		})
	}

	function logTrace(message: string, payload?: unknown): void {
		if (!trace) {
			return
		}

		if (payload === undefined) {
			console.log(message)
			return
		}

		console.log(message, payload)
	}

	function getStoreOperationLabel(context: StoreEventContext): string {
		const storeName = objectNames.get(context.store) ?? 'Store'

		if (context.method === 'clear') {
			return `${storeName}.clear`
		}

		if (context.method === 'set') {
			return `${storeName}.set(${context.normalizedKey} = ${formatStoreValue(
				context.value,
			)})`
		}

		return `${storeName}.${context.method}(${context.normalizedKey})`
	}

	function getAsyncLabel(label: string): string {
		const parentId = stack.at(-1)

		if (parentId === undefined) {
			return label
		}

		const parent = getNodes().find((node) => node.id === parentId)

		if (parent === undefined) {
			return label
		}

		return `${parent.label} ${label}`
	}

	function popAsyncNode(label: string): void {
		const nodeId = stack.at(-1)

		if (nodeId === undefined) {
			return
		}

		const node = getNodes().find((candidate) => candidate.id === nodeId)

		if (node?.kind === 'async' && node.label.endsWith(` ${label}`)) {
			stack.pop()
			return
		}

		popNode(label)
	}
}

function formatStoreValue(value: unknown): string {
	if (value === null) {
		return 'null'
	}

	if (value === undefined) {
		return 'undefined'
	}

	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return String(value)
	}

	if (value instanceof AbortController) {
		return 'AbortController'
	}

	if (Array.isArray(value)) {
		return `Array(${value.length})`
	}

	if (typeof value === 'object') {
		return value.constructor.name || 'Object'
	}

	return typeof value
}

interface DependencyDeclaredPayload {
	from: string
	to: string
	type?: string
}

function isDependencyDeclaredPayload(
	payload: unknown,
): payload is DependencyDeclaredPayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'from' in payload &&
		'to' in payload &&
		typeof payload.from === 'string' &&
		typeof payload.to === 'string' &&
		(!('type' in payload) || typeof payload.type === 'string')
	)
}

function printNode(
	node: DependencyGraphNode,
	nodes: readonly DependencyGraphNode[],
	edges: readonly DependencyGraphEdge[],
	depth: number,
	visitedPath: Set<number>,
): void {
	const suffix = node.count > 1 ? ` x${node.count}` : ''
	console.log(`${'  '.repeat(depth)}${node.label}${suffix}`)

	if (visitedPath.has(node.id)) {
		return
	}

	const nextVisitedPath = new Set(visitedPath)
	nextVisitedPath.add(node.id)

	for (const edge of edges.filter((candidate) => candidate.from === node.id)) {
		const child = nodes.find((candidate) => candidate.id === edge.to)

		if (child === undefined) {
			continue
		}

		const type = edge.type === undefined ? '' : ` ${edge.type}`
		const edgeSuffix = edge.count > 1 ? ` x${edge.count}` : ''
		console.log(`${'  '.repeat(depth + 1)}↓${type}${edgeSuffix}`)
		printNode(child, nodes, edges, depth + 1, nextVisitedPath)
	}
}
