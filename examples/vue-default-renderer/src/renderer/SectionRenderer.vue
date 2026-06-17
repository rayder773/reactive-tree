<script setup lang="ts">
import type { AnyNode, SectionNode } from '../../../../src'
import DiagnosticsView from './DiagnosticsView.vue'
import NodeRenderer from './NodeRenderer.vue'
import { childEntries, nodeTitle } from './rendererUtils'

defineProps<{
  node: SectionNode<any>
  root: AnyNode
  label?: string
}>()
</script>

<template>
  <fieldset class="node section-node">
    <legend>{{ nodeTitle(node, label || 'section') }}</legend>
    <DiagnosticsView :diagnostics="node.diagnostics.value" />

    <div class="children">
      <NodeRenderer
        v-for="entry in childEntries(node)"
        :key="entry.key"
        :node="entry.node"
        :root="root"
        :label="entry.key"
      />
    </div>
  </fieldset>
</template>
