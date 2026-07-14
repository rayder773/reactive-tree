<script lang="ts">
import { defineComponent, inject, type PropType, provide } from 'vue'
import {
	type ContextNode,
	createChildRenderContext,
	EMPTY_RENDER_CONTEXT,
} from '../../ui'
import { RENDER_CTX_KEY } from './renderContext'

export default defineComponent({
	name: 'AppContext',
	props: {
		context: {
			type: Object as PropType<ContextNode>,
			required: true,
		},
	},
	setup(props) {
		const parentContext = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const resolved = props.context.resolve(parentContext)
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
