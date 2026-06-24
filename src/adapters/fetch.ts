import type { AsyncNode } from '../types'

export interface FetchBinding<T> {
  node: AsyncNode<T>
  fetch: (signal: AbortSignal) => Promise<T>
}

export function createFetchAdapter<T>(
  _tree: unknown,
  bindings: FetchBinding<T>[],
): void {
  for (const { node, fetch } of bindings) {
    node.__register(fetch)
    node.refetch()
  }
}
