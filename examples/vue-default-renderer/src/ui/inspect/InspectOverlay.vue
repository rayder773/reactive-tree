<script setup lang="ts">
import { computed } from 'vue'
import type { AnyNode } from '../../../../../src'
import { controlKind, oneOfOptions, manyOfOptions } from '../../renderer/rendererUtils'
import { activeEntry, cancelHide, scheduleHide } from './state'

const pos = computed(() => {
  const rect = activeEntry.value?.badgeRect
  if (!rect) return null
  const panelWidth = 260
  const spaceRight = window.innerWidth - rect.right
  const left = spaceRight >= panelWidth + 10
    ? rect.right + 10
    : Math.max(4, rect.left - panelWidth - 10)
  const top = Math.min(rect.top, window.innerHeight - 340)
  return { top, left }
})

const d = computed(() => activeEntry.value?.descriptor as any)

function isDisplayInputNode(v: any): boolean {
  return v?.kind === 'input'
}

// For InputNode: source is the underlying tree node
// For any AnyNode: use it directly
function getSource(v: any): AnyNode | null {
  if (isDisplayInputNode(v)) return v.source ?? null
  if (v?.kind && typeof v.set === 'function') return v as AnyNode
  return null
}

function getDataRoot(v: any): AnyNode | null {
  if (isDisplayInputNode(v)) return (v as any).dataRoot ?? getSource(v)
  return getSource(v)
}

function getLabel(v: any): string {
  if (isDisplayInputNode(v)) return v.source?.label ?? v.source?.id ?? 'InputNode'
  return v?.label ?? v?.id ?? 'Node'
}

const source = computed(() => getSource(d.value))
const dataRoot = computed(() => getDataRoot(d.value))

const kind = computed(() =>
  source.value && dataRoot.value ? controlKind(source.value, dataRoot.value) : 'text'
)
const options = computed(() =>
  source.value && dataRoot.value ? oneOfOptions(source.value, dataRoot.value) ?? [] : []
)
const manyOptions = computed(() =>
  source.value && dataRoot.value ? manyOfOptions(source.value, dataRoot.value) ?? [] : []
)

function setFromSelect(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  source.value?.set(val === '' ? null : val)
}

function setFromText(e: Event) {
  source.value?.set((e.target as HTMLInputElement).value)
}

function setFromNumber(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  source.value?.set(raw === '' ? null : Number(raw))
}

function setFromCheckbox(e: Event) {
  source.value?.set((e.target as HTMLInputElement).checked)
}

function isSelected(option: unknown): boolean {
  return Array.isArray(source.value?.value) && (source.value!.value as unknown[]).includes(option)
}

function toggleMany(option: unknown, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const current = Array.isArray(source.value?.value) ? [...(source.value!.value as unknown[])] : []
  source.value?.set(
    checked ? [...current, option] : current.filter(i => i !== option)
  )
}

function onToggleRow(row: Row, checked: boolean) {
  if (row.label === 'focused') {
    if (checked) {
      activeEntry.value?.focusFn()
    } else {
      ;(document.activeElement as HTMLElement)?.blur()
    }
  } else {
    row.node!.set(checked)
  }
}

function stringify(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  try { return JSON.stringify(v) } catch { return String(v) }
}

interface Row {
  label: string
  value: unknown
  node?: { value: unknown; set: (v: unknown) => void }
}

function makeRow(label: string, node: any): Row | null {
  if (!node) return null
  const value = node.value ?? false
  if (value === undefined) return null
  const settable = typeof node.set === 'function'
  return { label, value, node: settable ? node : undefined }
}

const rows = computed((): Row[] => {
  const v = d.value
  if (!v) return []

  const candidates: (Row | null)[] = []

  if (isDisplayInputNode(v)) {
    const src = v.source
    if (src) {
      if (src.valid !== undefined) candidates.push({ label: 'valid', value: src.valid?.value })
      if (src.invalid !== undefined) candidates.push({ label: 'invalid', value: src.invalid?.value })
      const errs = src.errors?.value
      if (Array.isArray(errs) && errs.length)
        candidates.push({ label: 'errors', value: errs.map((e: any) => e.message).join(', ') })
    }
    candidates.push(makeRow('touched', v.touched))
    candidates.push(makeRow('focused', v.focused))
    candidates.push(makeRow('dirty', v.dirty))
    candidates.push(makeRow('disabled', v.disabled))
    if (v.showError?.value && v.errorMessage?.value)
      candidates.push({ label: 'errorMessage', value: v.errorMessage.value })
  } else {
    if (v.label) candidates.push({ label: 'label', value: v.label })
    if (v.valid?.value !== undefined) candidates.push({ label: 'valid', value: v.valid?.value })
    if (v.invalid?.value !== undefined) candidates.push({ label: 'invalid', value: v.invalid?.value })
    const errs = v.errors?.value
    if (Array.isArray(errs) && errs.length)
      candidates.push({ label: 'errors', value: errs.map((e: any) => e.message).join(', ') })
    if (v.status !== undefined) candidates.push({ label: 'status', value: v.status?.value })
  }

  return candidates.filter((r): r is Row => r !== null && r.value !== undefined)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="activeEntry && pos"
      class="inspect-overlay"
      :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
      @mouseenter="cancelHide"
      @mouseleave="scheduleHide"
    >
      <div class="inspect-title">{{ getLabel(d) }}</div>

      <div class="inspect-value-row">
        <span class="inspect-key">value</span>

        <span v-if="kind === 'checkboxGroup'" class="inspect-checkbox-group">
          <label v-for="opt in manyOptions" :key="String(opt)">
            <input type="checkbox" :checked="isSelected(opt)" @change="toggleMany(opt, $event)" />
            {{ opt }}
          </label>
        </span>

        <select v-else-if="kind === 'select'" :value="String(source?.value ?? '')" @change="setFromSelect">
          <option value="">—</option>
          <option v-for="opt in options" :key="String(opt)" :value="String(opt)">{{ opt }}</option>
        </select>

        <input
          v-else-if="kind === 'checkbox'"
          type="checkbox"
          :checked="Boolean(source?.value)"
          @change="setFromCheckbox"
        />

        <input
          v-else-if="kind === 'number'"
          type="number"
          :value="source?.value as number"
          @change="setFromNumber"
        />

        <span v-else-if="kind === 'file'" class="inspect-val">{{ stringify(source?.value) }}</span>

        <input
          v-else
          type="text"
          :value="source?.value as string ?? ''"
          @input="setFromText"
        />
      </div>

      <div v-for="row in rows" :key="row.label" class="inspect-row">
        <span class="inspect-key">{{ row.label }}</span>
        <label v-if="row.node && typeof row.value === 'boolean'" class="inspect-toggle">
          <input
            type="checkbox"
            :checked="Boolean(row.node.value)"
            @change="onToggleRow(row, ($event.target as HTMLInputElement).checked)"
          />
          <span :class="row.node.value ? 'is-true' : 'is-false'">{{ row.node.value }}</span>
        </label>
        <span
          v-else
          class="inspect-val"
          :class="{ 'is-true': row.value === true, 'is-false': row.value === false }"
        >{{ stringify(row.value) }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.inspect-overlay {
  position: fixed;
  z-index: 9999;
  background: #1e1e2e;
  color: #cdd6f4;
  border: 1px solid #45475a;
  border-radius: 6px;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 12px;
  width: 260px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  pointer-events: auto;
}

.inspect-title {
  font-weight: 700;
  color: #89b4fa;
  margin-bottom: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inspect-value-row,
.inspect-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  border-top: 1px solid #313244;
  min-height: 24px;
}

.inspect-key {
  color: #a6adc8;
  flex-shrink: 0;
  width: 80px;
}

.inspect-val {
  color: #cdd6f4;
  word-break: break-all;
}
.inspect-val.is-true  { color: #a6e3a1; }
.inspect-val.is-false { color: #f38ba8; }

.inspect-value-row input[type="text"],
.inspect-value-row input[type="number"],
.inspect-value-row select {
  background: #313244;
  border: 1px solid #585b70;
  border-radius: 3px;
  color: #cdd6f4;
  font-family: monospace;
  font-size: 12px;
  padding: 2px 5px;
  flex: 1;
  min-width: 0;
}

.inspect-value-row input:focus,
.inspect-value-row select:focus {
  outline: none;
  border-color: #89b4fa;
}

.inspect-value-row select option {
  background: #1e1e2e;
}

.inspect-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.inspect-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.inspect-checkbox-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
</style>
