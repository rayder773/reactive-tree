<script setup lang="ts">
import type { ButtonNode } from '../../../../src'

defineProps<{
  node?: ButtonNode | null
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    v-if="node?.kind === 'button' && node.display.value"
    v-inspect="node"
    class="app-button"
    :disabled="node.disabled.value"
    @click="$emit('click')"
  >
    {{ node.label ?? 'Submit' }}
  </button>
</template>

<style scoped>
.app-button {
  padding: 0.4rem 1.2rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  background: #fff;
  transition: background 0.15s, border-color 0.15s;
}

.app-button:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #999;
}

.app-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
