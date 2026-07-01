<script setup lang="ts">
import type { InputNode } from '../../../../src'
import { useInputBind } from './useInputBind'

const props = defineProps<{
  node: InputNode
  options: { value: string; label: string }[]
}>()

const { model, onFocus, onBlur, showError, errorMessage, disabled: isDisabled } = useInputBind(props.node)
</script>

<template>
  <div v-inspect="node" class="app-field" :class="{ 'has-error': showError, 'is-disabled': isDisabled }">
    <select v-model="model" :disabled="isDisabled" @focus="onFocus" @blur="onBlur">
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <span v-if="showError && errorMessage" class="error-msg">{{ errorMessage }}</span>
  </div>
</template>

<style scoped>
.app-field {
  display: inline-flex;
  flex-direction: column;
}

.app-field select {
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  min-width: 200px;
}

.app-field.is-disabled select {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-field.has-error select {
  border-color: #b00020;
  background: #fff5f5;
}

.error-msg {
  display: block;
  margin-top: 4px;
  color: #b00020;
  font-size: 0.8rem;
}
</style>
