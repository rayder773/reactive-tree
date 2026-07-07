import { toRaw, watch, type WatchStopHandle } from 'vue'
import { restoreTreeSnapshot, type TreeSnapshot } from './snapshot'
import type { AnyNode, AsyncNodeSnapshot } from './types'

export type PersistTreeSnapshotOptions = {
	key: string
	dbName?: string
	writeDelayMs?: number
	includeAsync?: boolean
}

type PersistStoreName = 'state' | 'async'

type PersistEntry = {
	treeKey: string
	nodeKey: string
	value?: unknown
	snapshot?: AsyncNodeSnapshot<any, any>
	updatedAt: number
}

type RequestIdleCallback = (
	callback: () => void,
	options?: { timeout?: number },
) => number

type CancelIdleCallback = (handle: number) => void

type ScheduledWrite = {
	cancel(): void
	run(): void
}

const DEFAULT_DB_NAME = 'reactive-tree'
const DEFAULT_WRITE_DELAY_MS = 100
const DB_VERSION = 1

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

function nodeKey(node: AnyNode): string {
	return node.id || node.__debug.path
}

function openPersistDb(dbName: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, DB_VERSION)

		request.onupgradeneeded = () => {
			const db = request.result

			for (const storeName of ['state', 'async'] as const) {
				if (db.objectStoreNames.contains(storeName)) {
					continue
				}

				const store = db.createObjectStore(storeName, {
					keyPath: ['treeKey', 'nodeKey'],
				})
				store.createIndex('treeKey', 'treeKey')
			}
		}

		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

async function loadStoreEntries(
	db: IDBDatabase,
	storeName: PersistStoreName,
	treeKey: string,
): Promise<PersistEntry[]> {
	const tx = db.transaction(storeName, 'readonly')
	const store = tx.objectStore(storeName)
	const index = store.index('treeKey')
	return requestToPromise(index.getAll(treeKey) as IDBRequest<PersistEntry[]>)
}

async function loadSnapshot(
	db: IDBDatabase,
	treeKey: string,
): Promise<TreeSnapshot | undefined> {
	const [stateEntries, asyncEntries] = await Promise.all([
		loadStoreEntries(db, 'state', treeKey),
		loadStoreEntries(db, 'async', treeKey),
	])

	if (!stateEntries.length && !asyncEntries.length) {
		return undefined
	}

	const snapshot: TreeSnapshot = {
		state: {},
		async: {},
	}

	for (const entry of stateEntries) {
		snapshot.state[entry.nodeKey] = entry.value
	}

	for (const entry of asyncEntries) {
		if (entry.snapshot) {
			snapshot.async[entry.nodeKey] = entry.snapshot
		}
	}

	return snapshot
}

function persistEntry(
	db: IDBDatabase,
	storeName: PersistStoreName,
	entry: PersistEntry,
): void {
	const snapshot = entry.snapshot
		? {
				...entry.snapshot,
				value: toRaw(entry.snapshot.value),
				error: toRaw(entry.snapshot.error),
				lastInput: toRaw(entry.snapshot.lastInput),
			}
		: undefined
	const tx = db.transaction(storeName, 'readwrite')
	tx.objectStore(storeName).put({
		...entry,
		value: toRaw(entry.value),
		snapshot,
	})
}

function scheduleIdle(callback: () => void, delayMs: number): ScheduledWrite {
	let timeoutHandle: ReturnType<typeof setTimeout> | undefined
	let idleHandle: number | undefined
	let done = false

	const win = typeof window === 'undefined' ? undefined : window
	const requestIdle = win
		? ((win as any).requestIdleCallback as RequestIdleCallback | undefined)
		: undefined
	const cancelIdle = win
		? ((win as any).cancelIdleCallback as CancelIdleCallback | undefined)
		: undefined

	function run() {
		if (done) {
			return
		}
		done = true
		callback()
	}

	timeoutHandle = setTimeout(() => {
		timeoutHandle = undefined

		if (requestIdle) {
			idleHandle = requestIdle(run, { timeout: delayMs })
			return
		}

		run()
	}, delayMs)

	return {
		cancel() {
			done = true
			if (timeoutHandle !== undefined) {
				clearTimeout(timeoutHandle)
			}
			if (idleHandle !== undefined && cancelIdle) {
				cancelIdle(idleHandle)
			}
		},
		run() {
			if (timeoutHandle !== undefined) {
				clearTimeout(timeoutHandle)
				timeoutHandle = undefined
			}
			if (idleHandle !== undefined && cancelIdle) {
				cancelIdle(idleHandle)
				idleHandle = undefined
			}
			run()
		},
	}
}

export function persistTreeSnapshot<T>(
	tree: T,
	options: PersistTreeSnapshotOptions,
): T {
	if (typeof indexedDB === 'undefined') {
		return tree
	}

	const treeKey = options.key
	const dbName = options.dbName ?? DEFAULT_DB_NAME
	const writeDelayMs = options.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
	const includeAsync = options.includeAsync ?? true
	const watchedNodes = new WeakMap<AnyNode, WatchStopHandle>()
	const pendingWrites = new Map<string, ScheduledWrite>()
	let db: IDBDatabase | undefined

	function queueWrite(
		storeName: PersistStoreName,
		key: string,
		entry: Omit<PersistEntry, 'treeKey' | 'nodeKey' | 'updatedAt'>,
	) {
		const pendingKey = `${storeName}:${key}`
		pendingWrites.get(pendingKey)?.cancel()

		const scheduledWrite = scheduleIdle(() => {
			pendingWrites.delete(pendingKey)
			if (!db) {
				return
			}
			try {
				persistEntry(db, storeName, {
					treeKey,
					nodeKey: key,
					updatedAt: Date.now(),
					...entry,
				})
			} catch {
				// Some user values are not structured-cloneable. Persistence is best-effort.
			}
		}, writeDelayMs)

		pendingWrites.set(pendingKey, scheduledWrite)
	}

	function flushPendingWrites() {
		for (const write of Array.from(pendingWrites.values())) {
			write.run()
		}
	}

	function watchNode(node: AnyNode) {
		if (watchedNodes.has(node)) {
			return
		}

		if (node.kind === 'state') {
			const key = nodeKey(node)
			watchedNodes.set(
				node,
				watch(
					() => node.value,
					(value) => {
						queueWrite('state', key, { value })
					},
					{ deep: true },
				),
			)
			return
		}

		if (
			includeAsync &&
			node.kind === 'async' &&
			typeof node.snapshot === 'function'
		) {
			const key = nodeKey(node)
			watchedNodes.set(
				node,
				watch(
					() => node.snapshot(),
					(snapshot) => {
						queueWrite('async', key, { snapshot })
					},
					{ deep: true },
				),
			)
		}
	}

	function watchCurrentNodes() {
		visitNodes(tree, watchNode)
	}

	openPersistDb(dbName)
		.then(async (openedDb) => {
			db = openedDb
			const snapshot = await loadSnapshot(openedDb, treeKey)
			restoreTreeSnapshot(tree, snapshot)
			watchCurrentNodes()

			if (isNode(tree) && (tree as any).debug) {
				watch(
					() =>
						(tree as any).debug.nodes.value
							.map((node: AnyNode['__debug']) => node.id)
							.join('\u0000'),
					() => watchCurrentNodes(),
				)
			}
		})
		.catch(() => {
			// Persistence is best-effort; tree creation should not fail because storage is unavailable.
		})

	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', flushPendingWrites)
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				flushPendingWrites()
			}
		})
	}

	return tree
}
