<script lang="ts">
import { defineComponent, inject, type PropType } from 'vue'
import {
	EMPTY_RENDER_CONTEXT,
	type TableColumn,
	type TableNode,
} from '../../ui'
import { RENDER_CTX_KEY } from './renderContext'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
	name: 'AppTable',
	props: {
		node: {
			type: Object as PropType<TableNode<unknown>>,
			required: true,
		},
	},
	setup(props) {
		const ctx = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const resolved = props.node.resolve(ctx)
		return {
			columns: props.node.columns,
			formatValue,
			getRowKey,
			isVisible: useReactiveValue(resolved.isVisible),
			rows: useReactiveValue(resolved.rows),
		}
	},
})

function getRowKey(row: unknown, index: number): string {
	if (
		typeof row === 'object' &&
		row !== null &&
		'id' in row &&
		typeof row.id === 'string'
	) {
		return row.id
	}

	return String(index)
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return ''
	}

	return String(value)
}

export type AppTableColumn<TRow> = TableColumn<TRow>
</script>

<template>
  <table v-if="isVisible">
    <thead>
      <tr>
        <th
          v-for="(column, columnIndex) in columns"
          :key="column.id"
        >
          <slot
            name="header"
            :column="column"
            :column-index="columnIndex"
          >
            {{ column.header }}
          </slot>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(row, rowIndex) in rows"
        :key="getRowKey(row, rowIndex)"
      >
        <td
          v-for="(column, columnIndex) in columns"
          :key="column.id"
        >
          <slot
            name="cell"
            :column="column"
            :column-index="columnIndex"
            :row="row"
            :row-index="rowIndex"
            :value="column.getValue(row)"
          >
            {{ formatValue(column.getValue(row)) }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>
