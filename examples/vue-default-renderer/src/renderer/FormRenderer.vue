<script setup lang="ts">
import type { AnyNode } from '../../../../src'
import type { FormNode } from '../../../../src/display'
import NodeRenderer from './NodeRenderer.vue'
import { formChildEntries, nodeTitle } from './rendererUtils'

defineProps<{
	node: FormNode<any>
	root: AnyNode
	label?: string
}>()
</script>

<template>
  <fieldset class="node form-node">
    <legend>{{ nodeTitle(node, label || 'form') }}</legend>
    <div v-if="node.isAnyTouched.value || node.isAnyDirty.value || node.isSubmitting.value || node.disabled.value" class="form-status">
      <span v-if="node.isAnyTouched.value" class="badge touched">any touched</span>
      <span v-if="node.isAnyDirty.value" class="badge dirty">any dirty</span>
      <span v-if="node.isSubmitting.value" class="badge submitting">submitting</span>
      <span v-if="node.disabled.value" class="badge disabled">disabled</span>
    </div>
    <div class="children">
      <NodeRenderer
        v-for="entry in formChildEntries(node)"
        :key="entry.key"
        :node="entry.node"
        :root="root"
        :label="entry.key"
      />
    </div>
  </fieldset>
</template>

<style scoped>
.form-node {
  border: 2px solid #4375b7;
  border-radius: 6px;
}

.form-status {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid currentColor;
}

.badge.touched    { color: #2563eb; }
.badge.dirty      { color: #8a5a00; }
.badge.submitting { color: #7c3aed; }
.badge.disabled   { color: #888; }
</style>
