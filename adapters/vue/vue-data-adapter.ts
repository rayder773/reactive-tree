import { shallowRef, type ShallowRef } from 'vue'
import type { Data, DataAdapter, DataSubscriber } from '../../core'

export const vueDataAdapter: DataAdapter = {
  create<T>(initialValue: T): Data<T> {
    const value = shallowRef<unknown>() as ShallowRef<T>
    value.value = initialValue
    const subscribers = new Set<DataSubscriber<T>>()

    const set = (nextValue: T) => {
      const previousValue = value.value
      if (Object.is(previousValue, nextValue)) return
      value.value = nextValue
      for (const subscriber of [...subscribers]) {
        subscriber(nextValue, previousValue)
      }
    }

    return {
      get: () => value.value,
      set,
      update: (updater) => set(updater(value.value)),
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
  },
}
