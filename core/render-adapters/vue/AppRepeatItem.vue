<script lang="ts">
import { defineComponent, type PropType, provide } from 'vue'
import {
	type ContextNode,
	createChildRenderContext,
	type RenderContext,
} from '../../ui'
import { RENDER_CTX_KEY } from './renderContext'

export default defineComponent({
	name: 'AppRepeatItem',
	props: {
		context: {
			type: Object as PropType<ContextNode<unknown, unknown> | undefined>,
			default: undefined,
		},
		item: {
			required: true,
		},
		parentContext: {
			type: Object as PropType<RenderContext>,
			required: true,
		},
	},
	setup(props) {
		if (props.context === undefined) {
			provide(RENDER_CTX_KEY, props.parentContext)
			return
		}

		const resolved = props.context.resolve(props.parentContext, props.item)
		const renderContext = createChildRenderContext(
			props.parentContext,
			props.context.id,
			resolved.value,
		)

		provide(RENDER_CTX_KEY, renderContext)
	},
})
</script>

<template>
  <slot />
</template>
