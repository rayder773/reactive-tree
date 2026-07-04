<script setup lang="ts">
import { computed } from 'vue'
import type { AnyNode } from '../../../../src'
import type { InputNode } from '../../../../src/display'
import {
  controlKind,
  fileTypeAccept,
  manyOfOptions,
  nodeTitle,
  oneOfOptions,
  stringifyValue,
} from './rendererUtils'
import { fileToData } from './fileUtils'

const props = defineProps<{
  node: InputNode
  root: AnyNode
  label?: string
}>()

const source = computed(() => props.node.source ?? null)
const dataRoot = computed((): AnyNode => (props.node as any).dataRoot ?? props.root)
const title = computed(() => nodeTitle(props.node, props.label || 'input'))
const asNode = (s: NonNullable<typeof source.value>) => s as unknown as AnyNode
const kind = computed(() => source.value ? controlKind(asNode(source.value), dataRoot.value) : 'text')
const accept = computed(() => source.value ? fileTypeAccept(asNode(source.value)) : undefined)
const options = computed(() => source.value ? oneOfOptions(asNode(source.value), dataRoot.value) ?? [] : [])
const manyOptions = computed(() => source.value ? manyOfOptions(asNode(source.value), dataRoot.value) ?? [] : [])

function onFocus() {
  props.node.focused.set(true)
}

function onBlur() {
  props.node.focused.set(false)
  props.node.touched.set(true)
}

function setFromText(event: Event) {
  source.value?.set((event.target as HTMLInputElement).value)
}

function setFromNumber(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  source.value?.set(raw === '' ? null : Number(raw))
}

function setFromCheckbox(event: Event) {
  source.value?.set((event.target as HTMLInputElement).checked)
}

function setFromSelect(event: Event) {
  const selected = (event.target as HTMLSelectElement).value
  source.value?.set(selected === '' ? null : selected)
}

async function setFromFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  source.value?.set(file ? await fileToData(file) : null)
}

function isSelected(option: unknown): boolean {
  return Array.isArray(source.value?.value) && source.value!.value.includes(option)
}

function toggleMany(option: unknown, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const current = Array.isArray(source.value?.value) ? [...source.value!.value] : []
  if (checked && !current.includes(option)) {
    source.value?.set([...current, option])
  } else if (!checked) {
    source.value?.set(current.filter((item: unknown) => item !== option))
  }
}
</script>

<template>
  <div
    class="node input-node"
    :class="{ 'has-error': node.showError.value, 'is-disabled': node.disabled.value }"
  >
    <label v-if="source" class="field-row">
      <span class="field-label">{{ title }}</span>

      <span v-if="kind === 'checkboxGroup'" class="checkbox-group">
        <label v-for="option in manyOptions" :key="String(option)">
          <input
            type="checkbox"
            :checked="isSelected(option)"
            @change="toggleMany(option, $event)"
            @focus="onFocus"
            @blur="onBlur"
          />
          {{ option }}
        </label>
      </span>

      <select
        v-else-if="kind === 'select'"
        :value="source.value ?? ''"
        :disabled="node.disabled.value"
        @change="setFromSelect"
        @focus="onFocus"
        @blur="onBlur"
      >
        <option value="">None</option>
        <option v-for="option in options" :key="String(option)" :value="String(option)">
          {{ option }}
        </option>
      </select>

      <input
        v-else-if="kind === 'checkbox'"
        type="checkbox"
        :checked="Boolean(source.value)"
        :disabled="node.disabled.value"
        @change="setFromCheckbox"
        @focus="onFocus"
        @blur="onBlur"
      />

      <input
        v-else-if="kind === 'number'"
        type="number"
        :value="source.value ?? ''"
        :disabled="node.disabled.value"
        @input="setFromNumber"
        @focus="onFocus"
        @blur="onBlur"
      />

      <span v-else-if="kind === 'file'" class="file-control">
        <input
          type="file"
          :accept="accept ?? undefined"
          :disabled="node.disabled.value"
          @change="setFromFile"
          @focus="onFocus"
          @blur="onBlur"
        />
        <small v-if="source.value">{{ stringifyValue(source.value) }}</small>
        <small v-else-if="accept" class="file-accept-hint">{{ accept }}</small>
      </span>

      <input
        v-else
        type="text"
        :value="source.value ?? ''"
        :disabled="node.disabled.value"
        @input="setFromText"
        @focus="onFocus"
        @blur="onBlur"
      />
    </label>

    <!-- No source: just show label + state badges -->
    <div v-else class="input-header">
      <span class="field-label">{{ title }}</span>
      <span class="input-badges">
        <span v-if="node.touched.value" class="badge touched">touched</span>
        <span v-if="node.focused.value" class="badge focused">focused</span>
        <span v-if="node.dirty.value" class="badge dirty">dirty</span>
        <span v-if="node.disabled.value" class="badge disabled">disabled</span>
      </span>
    </div>

    <div v-if="node.showError.value && node.errorMessage.value" class="input-error-msg">
      {{ node.errorMessage.value }}
    </div>
  </div>
</template>

<style scoped>
.input-node {
  padding: 4px 0;
}

.input-node.has-error input,
.input-node.has-error select {
  border-color: #b00020 !important;
  background: #fff5f5 !important;
}

.input-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.input-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid currentColor;
}

.badge.touched  { color: #2563eb; }
.badge.focused  { color: #7c3aed; }
.badge.dirty    { color: #8a5a00; }
.badge.disabled { color: #888; }

.input-error-msg {
  margin-top: 4px;
  color: #b00020;
  font-size: 13px;
  padding-left: 2px;
}
</style>
