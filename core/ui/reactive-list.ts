import type { ReactivityApi } from '../reactivity'

export interface ReactiveList<T> {
  get(): readonly T[]
  append(items: readonly T[]): void
  remove(predicate: (item: T) => boolean): void
  clear(): void
}

export function createReactiveList<T>(reactivity: ReactivityApi): ReactiveList<T> {
  const ref = reactivity.ref<readonly T[]>([])

  return {
    get: () => ref.get(),
    append: (items) => ref.update((current) => [...current, ...items]),
    remove: (predicate) => ref.update((current) => current.filter((item) => !predicate(item))),
    clear: () => ref.set([]),
  }
}
