<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { ButtonNode } from '../../ui'
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
		const run = () => {
			void Promise.resolve(props.node.onClick())
		}

		return {
			disabled: useReactiveValue(props.node.disabled),
			isVisible: useReactiveValue(props.node.isVisible),
			run,
			text: useReactiveValue(props.node.text),
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
