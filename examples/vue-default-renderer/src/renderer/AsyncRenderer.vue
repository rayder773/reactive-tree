<script setup lang="ts">
import { computed } from 'vue'
import type { AsyncNode } from '../../../../src'
import DiagnosticsView from './DiagnosticsView.vue'
import { nodeTitle, stringifyValue } from './rendererUtils'

const props = defineProps<{
  node: AsyncNode<unknown>
  label?: string
}>()

const title = computed(() => nodeTitle(props.node, props.label || 'async'))
const isPending = computed(
  () => props.node.status === 'loading' || props.node.status === 'revalidating',
)
</script>

<template>
  <div class="node async-node">
    <div class="async-header">
      <span class="field-label">{{ title }}</span>
      <span :class="['async-status', `async-status--${node.status}`]">{{ node.status }}</span>
      <button class="async-refetch" :disabled="isPending" @click="node.refetch()">
        Refetch
      </button>
    </div>

    <div v-if="isPending" class="async-loading">Loading…</div>

    <pre v-else-if="node.value !== null">{{ stringifyValue(node.value) }}</pre>

    <div v-if="node.error" class="async-error">
      {{ node.error.message }}
      <span v-if="node.error.status"> ({{ node.error.status }})</span>
      <span v-if="node.error.code"> [{{ node.error.code }}]</span>
    </div>

    <DiagnosticsView :diagnostics="node.diagnostics.value" />
  </div>
</template>
