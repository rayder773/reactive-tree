import { data, defaultDataAdapter, readonlyData, type DataAdapter } from '../../../core'

export function createCounterController(dataAdapter: DataAdapter = defaultDataAdapter) {
  const count = data(0, dataAdapter)
  return {
    count: readonlyData(count),
    increment: () => count.update((value) => value + 1),
    decrement: () => count.update((value) => value - 1),
    reset: () => count.set(0),
  }
}

export type CounterController = ReturnType<typeof createCounterController>
