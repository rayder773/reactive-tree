<script setup lang="ts">
import { computed } from 'vue'
import type { AnyNode, StateNode } from '../../../../src'
import DiagnosticsView from './DiagnosticsView.vue'
import {
  controlKind,
  manyOfOptions,
  nodeTitle,
  oneOfOptions,
  stringifyValue,
} from './rendererUtils'

const props = defineProps<{
  node: StateNode<unknown>
  root: AnyNode
  label?: string
}>()

const kind = computed(() => controlKind(props.node, props.root))
const options = computed(() => oneOfOptions(props.node, props.root) ?? [])
const manyOptions = computed(() => manyOfOptions(props.node, props.root) ?? [])
const title = computed(() => nodeTitle(props.node, props.label || 'state'))

function setFromText(event: Event) {
  props.node.set((event.target as HTMLInputElement).value)
}

function setFromNumber(event: Event) {
  const rawValue = (event.target as HTMLInputElement).value
  props.node.set(rawValue === '' ? null : Number(rawValue))
}

function setFromCheckbox(event: Event) {
  props.node.set((event.target as HTMLInputElement).checked)
}

function setFromSelect(event: Event) {
  const selected = (event.target as HTMLSelectElement).value
  props.node.set(selected === '' ? null : selected)
}

function setFromFile(event: Event) {
  props.node.set((event.target as HTMLInputElement).files?.[0] ?? null)
}

function isSelected(option: unknown): boolean {
  return Array.isArray(props.node.value) && props.node.value.includes(option)
}

function toggleMany(option: unknown, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const current = Array.isArray(props.node.value) ? [...props.node.value] : []

  if (checked && !current.includes(option)) {
    props.node.set([...current, option])
    return
  }

  if (!checked) {
    props.node.set(current.filter(item => item !== option))
  }
}
</script>

<template>
  <div class="node field-node">
    <label class="field-row">
      <span class="field-label">{{ title }}</span>

      <span v-if="kind === 'checkboxGroup'" class="checkbox-group">
        <label v-for="option in manyOptions" :key="String(option)">
          <input
            type="checkbox"
            :checked="isSelected(option)"
            @change="toggleMany(option, $event)"
          />
          {{ option }}
        </label>
      </span>

      <select v-else-if="kind === 'select'" :value="node.value ?? ''" @change="setFromSelect">
        <option value="">None</option>
        <option v-for="option in options" :key="String(option)" :value="String(option)">
          {{ option }}
        </option>
      </select>

      <input
        v-else-if="kind === 'checkbox'"
        type="checkbox"
        :checked="Boolean(node.value)"
        @change="setFromCheckbox"
      />

      <input
        v-else-if="kind === 'number'"
        type="number"
        :value="node.value ?? ''"
        @input="setFromNumber"
      />

      <span v-else-if="kind === 'file'" class="file-control">
        <input type="file" @change="setFromFile" />
        <small v-if="node.value">Selected: {{ stringifyValue(node.value) }}</small>
      </span>

      <input
        v-else
        type="text"
        :value="node.value ?? ''"
        @input="setFromText"
      />
    </label>

    <DiagnosticsView :diagnostics="node.diagnostics.value" />
  </div>
</template>
