<script setup lang="ts">
import { computed } from 'vue'
import type { InputNode } from '../../../../src'
import { fileToData } from '../renderer/fileUtils'
import { fileTypeAccept } from '../renderer/rendererUtils'
import { useInputBind } from './useInputBind'

const props = defineProps<{
  node?: InputNode | null
}>()

const { onFocus, onBlur, showError, errorMessage, disabled: isDisabled } = useInputBind(props.node)

const nodeLabel = computed(() => (props.node?.source as any)?.label ?? null)
const fileName = computed(() => (props.node?.source?.value as any)?.name ?? null)
const accept = computed(() => {
  const src = props.node?.source
  return src ? fileTypeAccept(src as any) : undefined
})
const acceptHint = computed(() => {
  if (!accept.value) return null
  return accept.value.split(',').join(', ')
})

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
    <span v-if="nodeLabel" class="field-label">
      {{ nodeLabel }}
      <span v-if="acceptHint" class="accept-hint">{{ acceptHint }}</span>
    </span>

    <label class="file-label">
      <input
        type="file"
        class="file-input-hidden"
        :accept="accept"
        :disabled="isDisabled"
        @change="onChange"
        @focus="onFocus"
        @blur="onBlur"
      />
      <slot :file-name="fileName" :accept="accept" :accept-hint="acceptHint" :is-disabled="isDisabled">
        <span class="file-trigger" :class="{ 'is-disabled': isDisabled }">
          {{ fileName ? 'Change file' : 'Choose file' }}
        </span>
        <span v-if="fileName" class="file-name">{{ fileName }}</span>
        <span v-else-if="acceptHint" class="file-hint">{{ acceptHint }}</span>
      </slot>
    </label>

    <span v-if="showError && errorMessage" class="error-msg">{{ errorMessage }}</span>
  </div>
</template>

<style scoped>
.app-field {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #333;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.accept-hint {
  font-size: 0.75rem;
  font-weight: 400;
  color: #888;
}

.file-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.app-field.is-disabled .file-label {
  cursor: not-allowed;
}

.file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.file-trigger {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
  background: #f5f5f5;
  user-select: none;
}

.file-trigger.is-disabled {
  opacity: 0.5;
}

.app-field.has-error .file-trigger {
  border-color: #b00020;
}

.file-name {
  font-size: 0.85rem;
  color: #333;
}

.file-hint {
  font-size: 0.8rem;
  color: #999;
}

.error-msg {
  display: block;
  color: #b00020;
  font-size: 0.8rem;
}
</style>
