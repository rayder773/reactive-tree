<script lang="ts">
import { defineComponent, inject, type PropType } from 'vue'
import { EMPTY_RENDER_CONTEXT, type TextNode } from '../../ui'
import { RENDER_CTX_KEY } from './renderContext'
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
		const ctx = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const resolved = props.node.resolve(ctx)
		return {
			isVisible: useReactiveValue(resolved.isVisible),
			value: useReactiveValue(resolved.value),
		}
	},
})
</script>

<template>
  <span v-if="isVisible">{{ value }}</span>
</template>
