import { data, readonlyData } from '../../../core'

export function createCounterController() {
  const count = data(0)
  return {
    count: readonlyData(count),
    increment: () => count.update((value) => value + 1),
    decrement: () => count.update((value) => value - 1),
    reset: () => count.set(0),
    dispose() {},
  }
}

export type CounterController = ReturnType<typeof createCounterController>
