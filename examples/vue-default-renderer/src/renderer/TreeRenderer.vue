<script setup lang="ts">
import type { AnyNode } from '../../../../src'
import NodeRenderer from './NodeRenderer.vue'

defineProps<{
  tree: AnyNode
}>()
</script>

<template>
  <section class="tree-renderer">
    <NodeRenderer :node="tree" :root="tree" label="root" />
  </section>
</template>
