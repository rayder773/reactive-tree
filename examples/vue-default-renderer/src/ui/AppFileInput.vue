<script setup lang="ts">
import { computed } from 'vue'
import type { InputNode } from '../../../../src'
import { fileToData } from '../renderer/fileUtils'
import { useInputBind } from './useInputBind'

const props = defineProps<{
  node?: InputNode | null
}>()

const { onFocus, onBlur, showError, errorMessage, disabled: isDisabled } = useInputBind(props.node)

const fileName = computed(() => (props.node?.source?.value as any)?.name ?? null)

async function onChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  props.node?.source?.set(file ? await fileToData(file) : null)
  props.node?.touched.set(true)
}
</script>

<template>
  <div
    v-if="node?.kind === 'input'"
    v-inspect="node"
    class="app-field"
    :class="{ 'has-error': showError, 'is-disabled': isDisabled }"
  >
    <label class="file-label">
      <input
        type="file"
        :disabled="isDisabled"
        @change="onChange"
        @focus="onFocus"
        @blur="onBlur"
      />
      <span v-if="fileName" class="file-name">{{ fileName }}</span>
    </label>
    <span v-if="showError && errorMessage" class="error-msg">{{ errorMessage }}</span>
  </div>
</template>

<style scoped>
.app-field {
  display: inline-flex;
  flex-direction: column;
}

.file-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-field.is-disabled input {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-field.has-error input {
  outline: 2px solid #b00020;
}

.file-name {
  font-size: 0.85rem;
  color: #555;
}

.error-msg {
  display: block;
  margin-top: 4px;
  color: #b00020;
  font-size: 0.8rem;
}
</style>
