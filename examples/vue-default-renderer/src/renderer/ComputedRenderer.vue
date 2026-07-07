<script setup lang="ts">
import type { ComputedNode } from '../../../../src'
import DiagnosticsView from './DiagnosticsView.vue'
import { nodeTitle, stringifyValue } from './rendererUtils'

defineProps<{
	node: ComputedNode<unknown>
	label?: string
}>()
</script>

<template>
  <div class="node computed-node">
    <div class="field-label">{{ nodeTitle(node, label || 'computed') }}</div>
    <pre>{{ stringifyValue(node.value) }}</pre>
    <DiagnosticsView :diagnostics="node.diagnostics.value" />
  </div>
</template>
