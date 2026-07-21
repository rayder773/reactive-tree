import { shallowRef, type ShallowRef } from 'vue'
import type { Data, DataAdapter, DataSubscriber } from '../../core'

export const vueDataAdapter: DataAdapter = {
  create<T>(initialValue: T): Data<T> {
    const state = shallowRef<unknown>() as ShallowRef<T>
    state.value = initialValue
    const subscribers = new Set<DataSubscriber<T>>()

    const set = (nextValue: T) => {
      const previousValue = state.value
      if (Object.is(previousValue, nextValue)) return
      state.value = nextValue
      for (const subscriber of [...subscribers]) {
        subscriber(nextValue, previousValue)
      }
    }

    return {
      get value() { return state.value },
      get: () => state.value,
      set,
      update: (updater) => set(updater(state.value)),
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
