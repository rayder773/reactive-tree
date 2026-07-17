import type { Data, DataAdapter, DataSubscriber, ReadonlyData } from './data.types'

function createData<T>(initialValue: T): Data<T> {
  let value = initialValue
  const subscribers = new Set<DataSubscriber<T>>()

  const set = (nextValue: T) => {
    if (Object.is(value, nextValue)) return
    const previousValue = value
    value = nextValue
    for (const subscriber of [...subscribers]) {
      subscriber(nextValue, previousValue)
    }
  }

  return {
    get: () => value,
    set,
    update(updater) {
      set(updater(value))
    },
    subscribe(subscriber) {
      subscribers.add(subscriber)
      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        subscribers.delete(subscriber)
      }
    },
  }
}

export const defaultDataAdapter: DataAdapter = {
  create: createData,
}

export function data<T>(initialValue: T, adapter: DataAdapter = defaultDataAdapter): Data<T> {
  return adapter.create(initialValue)
}

export function readonlyData<T>(source: Data<T>): ReadonlyData<T> {
  return {
    get: () => source.get(),
    subscribe: (subscriber) => source.subscribe(subscriber),
  }
}
