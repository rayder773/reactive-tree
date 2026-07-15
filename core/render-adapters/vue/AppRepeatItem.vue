<script lang="ts">
import { defineComponent, inject, type PropType, provide } from 'vue'
import {
	type ContextNode,
	createChildRenderContext,
	EMPTY_RENDER_CONTEXT,
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
			type: Object as PropType<RenderContext | undefined>,
			default: undefined,
		},
	},
	setup(props) {
		const injectedContext = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const parentContext = props.parentContext ?? injectedContext

		if (props.context === undefined) {
			provide(RENDER_CTX_KEY, parentContext)
			return
		}

		const resolved = props.context.resolve(parentContext, props.item)
		const renderContext = createChildRenderContext(
			parentContext,
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
