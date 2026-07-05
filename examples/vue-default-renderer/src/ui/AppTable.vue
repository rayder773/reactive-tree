<script setup lang="ts">
import type { TableNode } from '../../../../src'

defineProps<{
  node?: TableNode | null
}>()
</script>

<template>
  <div
    v-if="node?.kind === 'table'"
    class="app-table"
    :style="`grid-template-columns: repeat(${node.columns.value.length}, auto)`"
  >
    <div class="app-table-row app-table-header">
      <div
        v-for="col in node.columns.value"
        :key="col.id"
        v-inspect="node.columnNode(col.id)"
        class="app-table-cell"
      >
        {{ node.columnNode(col.id)?.value ?? col.id }}
      </div>
    </div>
    <div v-for="row in node.rows.value" :key="row.id" class="app-table-row">
      <div v-for="col in node.columns.value" :key="col.id" class="app-table-cell">
        <slot :name="`cell-${col.id}-${row.id}`" :row="row" :col="col">
          <span v-inspect="node.rowNode(row.id)">{{ node.rowNode(row.id)?.value ?? row.id }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-table {
  display: grid;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.app-table-row {
  display: contents;
}

.app-table-row.app-table-header .app-table-cell {
  background: #f5f5f5;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #666;
}

.app-table-cell {
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid #e0e0e0;
  border-right: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
}

.app-table-cell:last-child {
  border-right: none;
}

.app-table-row:last-child .app-table-cell {
  border-bottom: none;
}
</style>
