<script setup lang="ts">
import { provide, useSlots, h, markRaw } from 'vue'
import type { AnyNode } from '../../../../src'
import NodeRenderer from './NodeRenderer.vue'

const props = defineProps<{
  tree: AnyNode
  hide?: AnyNode[]
}>()

const slots = useSlots()
provide('treeSlots', slots)
provide('treeHide', () => props.hide ?? [])

const defaultTreeContent = markRaw(() =>
  h(NodeRenderer, { node: props.tree, root: props.tree, label: 'root' })
)
</script>

<template>
  <slot v-if="$slots.root" name="root" :children="defaultTreeContent" />
  <section v-else class="tree-renderer">
    <NodeRenderer :node="tree" :root="tree" label="root" />
  </section>
</template>
