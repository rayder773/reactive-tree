<script lang="ts">
import { defineComponent, inject, type PropType } from 'vue'
import { type ButtonNode, EMPTY_RENDER_CONTEXT } from '../../ui'
import { RENDER_CTX_KEY } from './renderContext'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
	name: 'AppButton',
	props: {
		node: {
			type: Object as PropType<ButtonNode>,
			required: true,
		},
	},
	setup(props) {
		const ctx = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const resolved = props.node.resolve(ctx)
		const run = () => void Promise.resolve(resolved.onClick())
		return {
			disabled: useReactiveValue(resolved.disabled),
			isVisible: useReactiveValue(resolved.isVisible),
			run,
			text: useReactiveValue(resolved.text),
		}
	},
})
</script>

<template>
  <button
    v-if="isVisible"
    type="button"
    :disabled="disabled"
    @click="run"
  >
    {{ text }}
  </button>
</template>
