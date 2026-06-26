import type { AsyncNode } from '../types'

export interface FetchBinding<T, TInput = void> {
  node: AsyncNode<T, TInput>
  fetch: (input: TInput, signal: AbortSignal) => Promise<T>
}

export function createFetchAdapter<T, TInput = void>(
  _tree: unknown,
  bindings: FetchBinding<T, TInput>[],
): void {
  for (const { node, fetch } of bindings) {
    node.__register(fetch)
    node.refetch()
  }
}
