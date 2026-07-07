<script setup lang="ts">
import type { AnyNode, RecordNode } from '../../../../src'
import DiagnosticsView from './DiagnosticsView.vue'
import NodeRenderer from './NodeRenderer.vue'
import { nodeTitle, recordEntries } from './rendererUtils'

defineProps<{
	node: RecordNode<AnyNode>
	root: AnyNode
	label?: string
}>()
</script>

<template>
  <fieldset class="node record-node">
    <legend>{{ nodeTitle(node, label || 'record') }}</legend>
    <DiagnosticsView :diagnostics="node.diagnostics.value" />

    <div v-if="!Object.keys(node.items.value).length" class="empty-node">Empty record</div>

    <NodeRenderer
      v-for="entry in recordEntries(node)"
      :key="entry.key"
      :node="entry.node"
      :root="root"
      :label="entry.key"
    />
  </fieldset>
</template>
