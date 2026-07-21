import type { Data, DataAdapter, DataSubscriber } from '../../core'

export const svelteDataAdapter: DataAdapter = {
  create<T>(initialValue: T): Data<T> {
    let value = $state.raw<T>(initialValue)
    const subscribers = new Set<DataSubscriber<T>>()
    const set = (nextValue: T) => {
      if (Object.is(value, nextValue)) return
      const previousValue = value
      value = nextValue
      for (const subscriber of [...subscribers]) subscriber(nextValue, previousValue)
    }
    return {
      get value() { return value },
      get: () => value,
      set,
      update: (updater) => set(updater(value)),
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
  },
}
