<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { RepeatNode } from '../../ui'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
	name: 'AppRepeat',
	props: {
		node: {
			type: Object as PropType<RepeatNode<unknown, unknown>>,
			required: true,
		},
	},
	setup(props) {
		return {
			children: useReactiveValue(props.node.children),
			isVisible: useReactiveValue(props.node.isVisible),
		}
	},
})
</script>

<template>
	<template v-if="isVisible">
		<div
			v-for="child in children"
			:key="child.key"
		>
			<slot
				:child="child"
				:index="child.index"
				:item="child.item"
				:node="child.node"
			/>
		</div>
	</template>
</template>
