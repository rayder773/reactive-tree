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
    get value() { return value },
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
  } as Data<T>
}

export const defaultDataAdapter: DataAdapter = {
  create: createData,
}

let dataAdapter: DataAdapter = defaultDataAdapter

export function setDataAdapter(adapter: DataAdapter): void {
  dataAdapter = adapter
}

export function getDataAdapter(): DataAdapter {
  return dataAdapter
}

export function data<T>(initialValue: T): Data<T> {
  return dataAdapter.create(initialValue)
}

export function readonlyData<T>(source: Data<T>): ReadonlyData<T> {
  const view = {
    get value() { return source.value },
    get: () => source.get(),
    subscribe: (subscriber) => source.subscribe(subscriber),
  } as ReadonlyData<T> & { __v_isRef?: true }

  if ((source as Data<T> & { __v_isRef?: boolean }).__v_isRef === true) {
    Object.defineProperty(view, '__v_isRef', { value: true })
  }

  return view
}
