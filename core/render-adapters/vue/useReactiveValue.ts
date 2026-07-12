import { onUnmounted, type ShallowRef, shallowRef } from 'vue'
import type { ReactiveSource } from '../../reactivity'

export function useReactiveValue<T>(source: ReactiveSource<T>): ShallowRef<T> {
	const value = shallowRef(source.get()) as ShallowRef<T>
	const subscription = source.subscribe(() => {
		value.value = source.get()
	})

	onUnmounted(() => {
		subscription.dispose()
	})

	return value
}
