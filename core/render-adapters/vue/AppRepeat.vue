<script lang="ts">
import { defineComponent, inject, type PropType } from 'vue'
import { EMPTY_RENDER_CONTEXT, type RepeatNode } from '../../ui'
import AppRepeatItem from './AppRepeatItem.vue'
import { RENDER_CTX_KEY } from './renderContext'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
	name: 'AppRepeat',
	components: { AppRepeatItem },
	props: {
		node: {
			type: Object as PropType<RepeatNode<unknown>>,
			required: true,
		},
	},
	setup(props) {
		const renderContext = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const resolved = props.node.resolve(renderContext)

		return {
			context: props.node.context,
			getKey: (item: unknown) => props.node.getKey(item),
			isVisible: useReactiveValue(resolved.isVisible),
			items: useReactiveValue(resolved.items),
			renderContext,
		}
	},
})
</script>

<template>
  <template v-if="isVisible">
    <AppRepeatItem
      v-for="item in items"
      :key="getKey(item)"
      :context="context"
      :item="item"
      :parent-context="renderContext"
    >
      <slot :item="item" />
    </AppRepeatItem>
  </template>
</template>
