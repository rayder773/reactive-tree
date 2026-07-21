import { type ReactNode, useSyncExternalStore } from 'react'
import type { Data, DataAdapter, DataSubscriber, Unsubscribe } from '../../core'

type AdapterSubscriber = () => void

const adapterSubscribers = new Set<AdapterSubscriber>()
let version = 0

const subscribeToAdapter = (subscriber: AdapterSubscriber): Unsubscribe => {
  adapterSubscribers.add(subscriber)
  return () => { adapterSubscribers.delete(subscriber) }
}

const notifyAdapterSubscribers = () => {
  version++
  for (const subscriber of [...adapterSubscribers]) subscriber()
}

export const reactDataAdapter: DataAdapter = {
  create<T>(initialValue: T): Data<T> {
    let value = initialValue
    const subscribers = new Set<DataSubscriber<T>>()
    const set = (nextValue: T) => {
      if (Object.is(value, nextValue)) return
      const previousValue = value
      value = nextValue
      for (const subscriber of [...subscribers]) subscriber(nextValue, previousValue)
      notifyAdapterSubscribers()
    }
    return {
      get value() { return value },
      get: () => value,
      set,
      update: (updater) => set(updater(value)),
      subscribe(subscriber) {
        subscribers.add(subscriber)
        return () => { subscribers.delete(subscriber) }
      },
    } as Data<T>
  },
}

export function ReactDataRoot({ render }: { render(): ReactNode }) {
  useSyncExternalStore(subscribeToAdapter, () => version, () => version)
  return render()
}
