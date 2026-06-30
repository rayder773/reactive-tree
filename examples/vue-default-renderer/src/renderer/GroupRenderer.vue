<script setup lang="ts">
import type { AnyNode } from '../../../../src'
import type { SectionNode } from '../../../../src/types'
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
  <fieldset class="node group-node">
    <legend>{{ nodeTitle(node, label || 'group') }}</legend>
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
