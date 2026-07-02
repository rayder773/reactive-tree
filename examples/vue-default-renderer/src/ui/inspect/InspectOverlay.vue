<script setup lang="ts">
import { computed } from 'vue'
import type { ActionNode, AnyNode, DebugStore } from '../../../../../src'
import { controlKind, oneOfOptions, manyOfOptions } from '../../renderer/rendererUtils'
import { activeEntry, cancelHide, scheduleHide } from './state'
import JsonView from '../../renderer/JsonView.vue'

function nodeDepLabels(store: DebugStore, node: AnyNode): string[] {
  const ids = store.readsOf(node)
  if (!ids.length) return []
  const nodeMap = new Map(store.nodes.value.map(n => [n.id, n]))
  return ids.map(id => {
    const info = nodeMap.get(id)
    if (info?.label) return info.label
    const parts = (info?.path ?? id).split('.')
    return parts.slice(-2).join('.')
  })
}

const pos = computed(() => {
  const rect = activeEntry.value?.badgeRect
  if (!rect) return null
  const panelWidth = 280
  const spaceRight = window.innerWidth - rect.right
  const left = spaceRight >= panelWidth + 10
    ? rect.right + 10
    : Math.max(4, rect.left - panelWidth - 10)
  const top = Math.min(rect.top, window.innerHeight - 400)
  return { top, left }
})

const d = computed(() => activeEntry.value?.descriptor as any)

// ── entity tag helpers ────────────────────────────────────────────────────────

type EntityTag = 'state' | 'computed' | 'async' | 'action' | 'display' | 'i18n' | null

function nodeTag(node: any): EntityTag {
  if (!node) return null
  if (node.kind === 'state') return 'state'
  if (node.kind === 'async') return 'async'
  if (node.kind === 'action') return 'action'
  if (node.kind === 'computed') return 'computed'
  return null
}

const TAG_LABEL: Record<NonNullable<EntityTag>, string> = {
  state: '◆ state',
  computed: '⟨⟩ computed',
  async: '⟳ async',
  action: '▶ action',
  display: '◻ display',
  i18n: 'α i18n',
}

// ── dom bindings ─────────────────────────────────────────────────────────────

interface DomBinding {
  prop: string
  value: unknown
  sourceNode: AnyNode | null
  tag: EntityTag
  editable: boolean
  deps?: string[]
}

const domBindings = computed((): DomBinding[] => {
  const v = d.value
  if (!v) return []
  return computeDomBindings(v)
})

function computeDomBindings(v: any): DomBinding[] {

  if (v.kind === 'input') {
    const src = v.source ?? null
    return [{
      prop: 'value',
      value: src?.value,
      sourceNode: src,
      tag: nodeTag(src),
      editable: typeof src?.set === 'function',
    }]
  }

  if (v.kind === 'button') {
    const store: DebugStore | undefined = v.__displayDebug
    const disabledDeps = store && v.disabled ? nodeDepLabels(store, v.disabled) : []
    return [
      {
        prop: 'textContent',
        value: v.label ?? 'Submit',
        sourceNode: null,
        tag: v.labelReactive ? 'i18n' as EntityTag : null,
        editable: false,
      },
      {
        prop: 'disabled',
        value: v.disabled?.value ?? false,
        sourceNode: v.disabled ?? null,
        tag: nodeTag(v.disabled) ?? 'display',
        editable: false,
        deps: disabledDeps,
      },
    ]
  }

  return []
}

// ── control kind for editable value ──────────────────────────────────────────

const inputSource = computed(() => {
  const v = d.value
  if (v?.kind === 'input') return v.source ?? null
  return null
})

const inputDataRoot = computed(() => {
  const v = d.value
  if (v?.kind === 'input') return v.dataRoot ?? inputSource.value
  return null
})

const kind = computed(() =>
  inputSource.value && inputDataRoot.value
    ? controlKind(inputSource.value, inputDataRoot.value)
    : 'text',
)

const options = computed(() =>
  inputSource.value && inputDataRoot.value
    ? oneOfOptions(inputSource.value, inputDataRoot.value) ?? []
    : [],
)

const manyOptions = computed(() =>
  inputSource.value && inputDataRoot.value
    ? manyOfOptions(inputSource.value, inputDataRoot.value) ?? []
    : [],
)

function setFromSelect(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  inputSource.value?.set(val === '' ? null : val)
}

function setFromText(e: Event) {
  inputSource.value?.set((e.target as HTMLInputElement).value)
}

function setFromNumber(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  inputSource.value?.set(raw === '' ? null : Number(raw))
}

function setFromCheckbox(e: Event) {
  inputSource.value?.set((e.target as HTMLInputElement).checked)
}

function isSelected(option: unknown): boolean {
  return Array.isArray(inputSource.value?.value) && (inputSource.value!.value as unknown[]).includes(option)
}

function toggleMany(option: unknown, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const current = Array.isArray(inputSource.value?.value) ? [...(inputSource.value!.value as unknown[])] : []
  inputSource.value?.set(
    checked ? [...current, option] : current.filter(i => i !== option)
  )
}

// ── handlers ─────────────────────────────────────────────────────────────────

interface HandlerEntry {
  event: string
  action: ActionNode
}

const handlers = computed((): HandlerEntry[] => {
  const v = d.value
  if (!v?.handlers) return []
  return Object.entries(v.handlers)
    .filter(([, h]) => h != null)
    .map(([event, action]) => ({ event, action: action as ActionNode }))
})

// ── ui state rows ─────────────────────────────────────────────────────────────

interface StateRow {
  label: string
  value: unknown
  node?: { value: unknown; set: (v: unknown) => void }
}

function makeRow(label: string, node: any): StateRow | null {
  if (!node) return null
  const value = node.value ?? false
  if (value === undefined) return null
  return { label, value, node: typeof node.set === 'function' ? node : undefined }
}

const uiStateRows = computed((): StateRow[] => {
  const v = d.value
  if (v?.kind !== 'input') return []

  const rows: (StateRow | null)[] = [
    makeRow('touched', v.touched),
    makeRow('focused', v.focused),
    makeRow('dirty', v.dirty),
    makeRow('disabled', v.disabled),
  ]

  if (v.showError?.value && v.errorMessage?.value) {
    rows.push({ label: 'errorMessage', value: v.errorMessage.value })
  }

  return rows.filter((r): r is StateRow => r !== null && r.value !== undefined)
})

// ── validation rows ───────────────────────────────────────────────────────────

interface ValidationRow {
  label: string
  value: unknown
}

const validationRows = computed((): ValidationRow[] => {
  const v = d.value
  if (!v) return []

  const src = v.kind === 'input' ? v.source : v
  if (!src) return []

  const rows: ValidationRow[] = []
  if (src.valid !== undefined) rows.push({ label: 'valid', value: src.valid?.value })

  const errs = src.errors?.value
  if (Array.isArray(errs) && errs.length) {
    rows.push({ label: 'errors', value: errs.map((e: any) => e.message).join(', ') })
  }

  return rows
})

// ── helpers ───────────────────────────────────────────────────────────────────

function stringify(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  try { return JSON.stringify(v) } catch { return String(v) }
}

function onToggleUiRow(row: StateRow, checked: boolean) {
  if (row.label === 'focused') {
    if (checked) activeEntry.value?.focusFn()
    else (document.activeElement as HTMLElement)?.blur()
  } else {
    row.node!.set(checked)
  }
}

function nodeLabel(v: any): string {
  if (v?.kind === 'input') return v.source?.label ?? v.source?.id ?? 'Input'
  return v?.label ?? v?.id ?? 'Node'
}
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
      <div class="inspect-title">{{ nodeLabel(d) }}</div>

      <!-- dom bindings -->
      <div class="inspect-section">
        <div class="inspect-section-label">dom bindings</div>

        <div v-for="binding in domBindings" :key="binding.prop" class="inspect-binding">
          <div class="inspect-row inspect-row--binding">
            <span class="inspect-key">{{ binding.prop }}</span>

            <!-- editable input value -->
            <template v-if="binding.editable && binding.prop === 'value'">
              <span v-if="kind === 'checkboxGroup'" class="inspect-checkbox-group">
                <label v-for="opt in manyOptions" :key="String(opt)">
                  <input type="checkbox" :checked="isSelected(opt)" @change="toggleMany(opt, $event)" />
                  {{ opt }}
                </label>
              </span>
              <select v-else-if="kind === 'select'" :value="String(inputSource?.value ?? '')" @change="setFromSelect">
                <option value="">—</option>
                <option v-for="opt in options" :key="String(opt)" :value="String(opt)">{{ opt }}</option>
              </select>
              <input
                v-else-if="kind === 'checkbox'"
                type="checkbox"
                :checked="Boolean(inputSource?.value)"
                @change="setFromCheckbox"
              />
              <input
                v-else-if="kind === 'number'"
                type="number"
                :value="inputSource?.value as number"
                @change="setFromNumber"
              />
              <span v-else-if="kind === 'file'" class="inspect-val inspect-file-val">
                <JsonView :value="inputSource?.value" />
              </span>
              <input
                v-else
                type="text"
                :value="inputSource?.value as string ?? ''"
                @input="setFromText"
              />
            </template>

            <!-- read-only value -->
            <template v-else>
              <span
                class="inspect-val inspect-val--inline"
                :class="{ 'is-true': binding.value === true, 'is-false': binding.value === false }"
              >{{ stringify(binding.value) }}</span>
            </template>

            <span v-if="binding.tag" :class="['entity-tag', `tag-${binding.tag}`]">
              {{ TAG_LABEL[binding.tag] }}
            </span>
          </div>
          <div v-if="binding.deps?.length" class="inspect-deps">
            ← {{ binding.deps.join(', ') }}
          </div>
        </div>
      </div>

      <!-- handlers -->
      <div v-if="handlers.length" class="inspect-section">
        <div class="inspect-section-label">handlers</div>
        <div v-for="h in handlers" :key="h.event" class="inspect-row">
          <span class="inspect-key">{{ h.event }}</span>
          <span class="inspect-val handler-name">
            {{ h.action.ownerLabel ?? h.action.ownerPath.split('.').pop() }}.{{ h.action.name }}
          </span>
          <span class="entity-tag tag-action">▶ action</span>
          <button class="invoke-btn" @click="h.action.call()">▶</button>
        </div>
      </div>

      <!-- validation -->
      <div v-if="validationRows.length" class="inspect-section">
        <div class="inspect-section-label">validation</div>
        <div v-for="row in validationRows" :key="row.label" class="inspect-row">
          <span class="inspect-key">{{ row.label }}</span>
          <span
            class="inspect-val"
            :class="{ 'is-true': row.value === true, 'is-false': row.value === false }"
          >{{ stringify(row.value) }}</span>
        </div>
      </div>

      <!-- ui state (inputs only) -->
      <div v-if="uiStateRows.length" class="inspect-section">
        <div class="inspect-section-label">ui state</div>
        <div v-for="row in uiStateRows" :key="row.label" class="inspect-row">
          <span class="inspect-key">{{ row.label }}</span>
          <label v-if="row.node && typeof row.value === 'boolean'" class="inspect-toggle">
            <input
              type="checkbox"
              :checked="Boolean(row.node.value)"
              @change="onToggleUiRow(row, ($event.target as HTMLInputElement).checked)"
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
  width: 280px;
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

.inspect-section {
  margin-top: 6px;
  border-top: 1px solid #313244;
  padding-top: 4px;
}

.inspect-section-label {
  font-size: 10px;
  color: #585b70;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 2px;
}

.inspect-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  min-height: 24px;
  flex-wrap: wrap;
}

.inspect-key {
  color: #a6adc8;
  flex-shrink: 0;
  width: 76px;
}

.inspect-val {
  color: #cdd6f4;
  word-break: break-all;
  flex: 1;
  min-width: 0;
}

.inspect-val.is-true  { color: #a6e3a1; }
.inspect-val.is-false { color: #f38ba8; }

.inspect-file-val {
  word-break: normal;
  overflow: hidden;
}

.handler-name {
  color: #cba6f7;
  flex: 1;
}

/* entity tags */
.entity-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  white-space: nowrap;
}

.tag-state    { background: #1e3a5f; color: #89b4fa; }
.tag-computed { background: #2d1b4e; color: #cba6f7; }
.tag-async    { background: #3d2000; color: #fab387; }
.tag-action   { background: #3d0000; color: #f38ba8; }
.tag-display  { background: #003d2d; color: #94e2d5; }
.tag-i18n     { background: #3d3400; color: #f9e2af; }

.inspect-binding {
  border-top: 1px solid #313244;
}

.inspect-binding .inspect-row {
  border-top: none;
  flex-wrap: nowrap;
}

.inspect-val--inline {
  flex: none !important;
}

.inspect-deps {
  font-size: 10px;
  color: #6c7086;
  padding: 1px 0 3px 82px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* invoke button */
.invoke-btn {
  background: #313244;
  border: 1px solid #585b70;
  color: #a6e3a1;
  border-radius: 3px;
  font-size: 10px;
  padding: 1px 5px;
  cursor: pointer;
  flex-shrink: 0;
}

.invoke-btn:hover {
  background: #45475a;
}

/* editable controls */
.inspect-row input[type="text"],
.inspect-row input[type="number"],
.inspect-row select {
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

.inspect-row input:focus,
.inspect-row select:focus {
  outline: none;
  border-color: #89b4fa;
}

.inspect-row select option {
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
