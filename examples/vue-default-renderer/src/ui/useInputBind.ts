import { computed } from 'vue'
import type { InputNode } from '../../../../src'

export function useInputBind(node: InputNode | undefined | null) {
	const model = computed({
		get: () => node?.source?.value,
		set: (v) => node?.source?.set(v),
	})

	function onFocus() {
		node?.focused.set(true)
	}

	function onBlur() {
		node?.focused.set(false)
		node?.touched.set(true)
	}

	return {
		model,
		onFocus,
		onBlur,
		showError: computed(() => node?.showError.value ?? false),
		errorMessage: computed(() => node?.errorMessage.value),
		disabled: computed(() => node?.disabled.value ?? false),
	}
}
