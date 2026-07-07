import type { AnyNode, AsyncNodeSnapshot } from './types'

export type TreeSnapshot = {
	state: Record<string, unknown>
	async: Record<string, AsyncNodeSnapshot<any, any>>
}

function isNode(value: unknown): value is AnyNode {
	return Boolean(
		value &&
			typeof value === 'object' &&
			'__debug' in value &&
			(value as AnyNode).__debug?.id,
	)
}

function visitNodes(root: unknown, visit: (node: AnyNode) => void): void {
	const seen = new WeakSet<object>()

	function walk(value: unknown) {
		if (!isNode(value) || seen.has(value)) {
			return
		}

		seen.add(value)
		visit(value)

		if (value.kind === 'list') {
			for (const item of value.items.value) {
				walk(item)
			}
			return
		}

		if (value.kind === 'record') {
			for (const item of Object.values(value.items.value)) {
				walk(item)
			}
			return
		}

		for (const key of Object.keys(value)) {
			walk(value[key])
		}
	}

	walk(root)
}

function snapshotNodeKey(node: AnyNode): string {
	return node.id || node.__debug.path
}

export function takeTreeSnapshot(root: unknown): TreeSnapshot {
	const snapshot: TreeSnapshot = {
		state: {},
		async: {},
	}

	visitNodes(root, (node) => {
		const key = snapshotNodeKey(node)

		if (node.kind === 'state') {
			snapshot.state[key] = node.value
			return
		}

		if (node.kind === 'async') {
			snapshot.async[key] =
				typeof node.snapshot === 'function'
					? node.snapshot()
					: {
							value: node.value,
							status: node.status,
							error: node.error,
							hasLastInput: false,
						}
		}
	})

	return snapshot
}

export function restoreTreeSnapshot(
	root: unknown,
	snapshot: TreeSnapshot | undefined,
): void {
	if (!snapshot) {
		return
	}

	const pendingState = new Map<string, unknown>(Object.entries(snapshot.state))

	visitNodes(root, (node) => {
		if (node.kind !== 'state') {
			return
		}

		const key = snapshotNodeKey(node)
		if (pendingState.has(key) && node.set(pendingState.get(key))) {
			pendingState.delete(key)
		}
	})

	visitNodes(root, (node) => {
		if (node.kind !== 'async' || typeof node.restore !== 'function') {
			return
		}

		const asyncSnapshot = snapshot.async[snapshotNodeKey(node)]
		if (asyncSnapshot) {
			node.restore(asyncSnapshot)
		}
	})

	visitNodes(root, (node) => {
		if (node.kind !== 'state') {
			return
		}

		const key = snapshotNodeKey(node)
		if (pendingState.has(key) && node.set(pendingState.get(key))) {
			pendingState.delete(key)
		}
	})
}
