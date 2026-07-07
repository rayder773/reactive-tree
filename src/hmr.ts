import {
	restoreTreeSnapshot,
	takeTreeSnapshot,
	type TreeSnapshot,
} from './snapshot'

export type HotContext = {
	data: Record<string, unknown>
	dispose(callback: (data: Record<string, unknown>) => void): void
}

export type HmrTreeSnapshotOptions = {
	key: string
}

type Disposable = {
	dispose?: () => void
}

export function preserveTreeSnapshotOnHmr<T>(
	tree: T,
	hot: HotContext | undefined,
	options: HmrTreeSnapshotOptions,
): T {
	if (!hot) {
		return tree
	}

	const snapshot = hot.data[options.key] as TreeSnapshot | undefined

	restoreTreeSnapshot(tree, snapshot)

	hot.dispose((data) => {
		data[options.key] = takeTreeSnapshot(tree)
		;(tree as Disposable).dispose?.()
	})

	return tree
}

export function disposeOnHmr<T>(resource: T, hot: HotContext | undefined): T {
	if (!hot) {
		return resource
	}

	hot.dispose(() => {
		;(resource as Disposable).dispose?.()
	})

	return resource
}
