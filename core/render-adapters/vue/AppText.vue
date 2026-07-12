<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { TextNode } from '../../ui'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
	name: 'AppText',
	props: {
		node: {
			type: Object as PropType<TextNode>,
			required: true,
		},
	},
	setup(props) {
		return {
			isVisible: useReactiveValue(props.node.isVisible),
			value: useReactiveValue(props.node.value),
		}
	},
})
</script>

<template>
	<span v-if="isVisible">{{ value }}</span>
</template>
