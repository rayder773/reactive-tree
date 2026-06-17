<script setup lang="ts">
import type { AnyNode, ListNode } from '../../../../src'
import DiagnosticsView from './DiagnosticsView.vue'
import NodeRenderer from './NodeRenderer.vue'
import { listEntries, nodeTitle } from './rendererUtils'

defineProps<{
  node: ListNode<AnyNode>
  root: AnyNode
  label?: string
}>()
</script>

<template>
  <fieldset class="node list-node">
    <legend>{{ nodeTitle(node, label || 'list') }}</legend>
    <DiagnosticsView :diagnostics="node.diagnostics.value" />

    <div v-if="!node.items.value.length" class="empty-node">Empty list</div>

    <NodeRenderer
      v-for="entry in listEntries(node)"
      :key="entry.key"
      :node="entry.node"
      :root="root"
      :label="entry.key"
    />
  </fieldset>
</template>
