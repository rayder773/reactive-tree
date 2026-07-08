<template>
  <div class="app-list-wrapper">
    <!-- Virtual scroll: outer container is the real scroll area -->
    <div
      v-if="node.virtual"
      class="app-list-scroll"
      :style="{ height: containerHeight + 'px' }"
      @scroll.passive="onScroll"
      ref="scrollEl"
    >
      <!-- Spacer that gives the scrollbar its full height -->
      <div class="app-list-spacer" :style="{ height: totalHeight + 'px' }" />

      <!-- Visible window, absolutely positioned at the current offset -->
      <div
        class="app-list-window"
        :style="{ transform: `translateY(${windowTop}px)` }"
      >
        <!-- tableNode-based rendering (new format) -->
        <component :is="'table'" v-if="tableNode" class="app-list-table">
          <thead>
            <tr>
              <th v-for="col in tableNode.columns.value" :key="col.id" class="app-list-th">
                {{ resolveText(col.text) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tableNode.rows.value"
              :key="row.id"
              class="app-list-row"
              :style="{ height: node.virtual.rowHeight + 'px' }"
            >
              <td class="app-list-td">
                {{ tableNode.rowNode(row.id)?.value ?? '' }}
              </td>
            </tr>
          </tbody>
        </component>

        <!-- Legacy columns-based table rendering -->
        <component :is="'table'" v-else-if="node.mode === 'table'" class="app-list-table">
          <thead>
            <tr>
              <th v-for="col in node.columns" :key="col.key" class="app-list-th">
                {{ resolveHeader(col.header) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in node.rows"
              :key="row.key"
              class="app-list-row"
              :class="{ 'app-list-row--empty': !row.id }"
              :style="{ height: node.virtual.rowHeight + 'px' }"
            >
              <td v-for="col in node.columns" :key="col.key" class="app-list-td">
                {{ row.id ? row.cells[col.key]?.value : '' }}
              </td>
            </tr>
          </tbody>
        </component>

        <ul v-else class="app-list-items">
          <li
            v-for="row in node.rows"
            :key="row.key"
            class="app-list-item"
            :style="{ height: node.virtual.rowHeight + 'px' }"
          >
            {{ row.cells['label']?.value ?? '' }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Non-virtual: render all rows -->
    <template v-else>
      <!-- tableNode-based rendering (new format) -->
      <table v-if="tableNode" class="app-list-table">
        <thead>
          <tr>
            <th v-for="col in tableNode.columns.value" :key="col.id" class="app-list-th">
              {{ resolveText(col.text) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableNode.rows.value" :key="row.id" class="app-list-row">
            <td class="app-list-td">
              {{ tableNode.rowNode(row.id)?.value ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Legacy columns-based table rendering -->
      <table v-else-if="node.mode === 'table'" class="app-list-table">
        <thead>
          <tr>
            <th v-for="col in node.columns" :key="col.key" class="app-list-th">
              {{ resolveHeader(col.header) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in allRows" :key="row.id ?? row.key" class="app-list-row">
            <td v-for="col in node.columns" :key="col.key" class="app-list-td">
              {{ row.cells[col.key]?.value ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>

      <ul v-else class="app-list-items">
        <li v-for="row in allRows" :key="row.id ?? row.key" class="app-list-item">
          {{ row.cells['label']?.value ?? '' }}
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ListDisplayNode } from '../../../../../src'

const props = defineProps<{ node: ListDisplayNode }>()

const scrollEl = ref<HTMLElement | null>(null)

// Access tableNode via cast since it's added dynamically
const tableNode = computed(() => (props.node as any).tableNode as import('../../../../../src').TableNode | undefined)

// ── Virtual scroll ────────────────────────────────────────────────────────────

const CONTAINER_HEIGHT = 480

const containerHeight = CONTAINER_HEIGHT

const totalHeight = computed(() => {
  const v = props.node.virtual
  if (!v) return 0
  return v.total.value * v.rowHeight
})

const windowTop = computed(() => {
  const v = props.node.virtual
  if (!v) return 0
  return v.offset.value * v.rowHeight
})

function onScroll(e: Event) {
  const v = props.node.virtual
  if (!v) return

  const el = e.target as HTMLElement
  const newOffset = Math.floor(el.scrollTop / v.rowHeight)
  const clamped = Math.max(
    0,
    Math.min(newOffset, Math.max(0, v.total.value - v.windowSize.value)),
  )

  if (clamped !== v.offset.value) {
    v.offset.set(clamped)
  }

  // Trigger onReachEnd when near the bottom of loaded data
  const loadedCount = (props.node.value as string[]).length
  const nearEnd = loadedCount > 0 && clamped + v.windowSize.value >= loadedCount - 2
  if (v.onReachEnd && nearEnd) {
    v.onReachEnd()
  }

  // Trigger onReachStart when at the very top
  if (v.onReachStart && el.scrollTop === 0) {
    v.onReachStart()
  }
}

// ── Non-virtual: build rows from all IDs ─────────────────────────────────────

const allRows = computed(() => {
  if (props.node.virtual) return []
  const ids = props.node.value as string[]
  return ids.map((id, i) => ({
    key: String(i),
    id,
    cells: Object.fromEntries(
      props.node.columns.map((col) => {
        const entity = (props.node as any).__resolve?.(id)
        const raw = entity ? col.cell(entity) : ''
        return [col.key, { value: typeof raw === 'function' ? raw() : raw }]
      }),
    ),
  }))
})

function resolveHeader(header: string | (() => string)): string {
  return typeof header === 'function' ? header() : header
}

function resolveText(text: string | (() => string)): string {
  return typeof text === 'function' ? text() : text
}
</script>

<style scoped>
.app-list-wrapper {
  position: relative;
  width: 100%;
}

.app-list-scroll {
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.app-list-spacer {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  pointer-events: none;
}

.app-list-window {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
}

.app-list-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.app-list-th {
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 1;
}

.app-list-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s;
}

.app-list-row:hover {
  background: #f8fafc;
}

.app-list-row--empty {
  opacity: 0;
  pointer-events: none;
}

.app-list-td {
  padding: 0 12px;
  font-size: 13px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-list-items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.app-list-item {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
}
</style>
