<script lang="ts">
import {
	defineComponent,
	h,
	inject,
	type PropType,
	useSlots,
	watchEffect,
} from 'vue'
import {
	EMPTY_RENDER_CONTEXT,
	type TableNode,
} from '../../ui'
import AppRepeatItem from './AppRepeatItem.vue'
import { RENDER_CTX_KEY } from './renderContext'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
	name: 'AppTable',
	components: { AppRepeatItem },
	props: {
		node: {
			type: Object as PropType<TableNode<unknown>>,
			required: true,
		},
	},
	setup(props) {
		const renderContext = inject(RENDER_CTX_KEY, EMPTY_RENDER_CONTEXT)
		const resolved = props.node.resolve(renderContext)
		const slots = useSlots()

		const columns = useReactiveValue(resolved.columns)
		const rows = useReactiveValue(resolved.rows)
		const isVisible = useReactiveValue(resolved.isVisible)

		const columnContext = props.node.columnContext

		watchEffect(() => {
			for (const col of columns.value) {
				if (!slots[`header-${col}`] && !slots.header) {
					console.warn(`[AppTable] no header slot for column "${col}"`)
				}
				if (!slots[`cell-${col}`] && !slots.cell) {
					console.warn(`[AppTable] no cell slot for column "${col}"`)
				}
			}
		})

		// Component rendered inside each row's AppRepeatItem.
		// Inherits row context via inject; provides column context per cell.
		const CellsRenderer = defineComponent({
			name: 'AppTableCells',
			setup() {
				return () =>
					columns.value.map((col) =>
						h(
							AppRepeatItem,
							{ context: columnContext, item: col, key: col },
							{
								default: () =>
									slots[`cell-${col}`]?.({ column: col }) ??
									slots.cell?.({ column: col }) ??
									[],
							},
						),
					)
			},
		})

		return {
			renderContext,
			rowContext: props.node.rowContext,
			columnContext,
			getRowKey: props.node.getRowKey,
			columns,
			rows,
			isVisible,
			CellsRenderer,
		}
	},
})
</script>

<template>
  <div v-if="isVisible && rows.length > 0" class="app-table">
    <!-- Headers: один AppRepeatItem per column -->
    <AppRepeatItem
      v-for="col in columns"
      :key="col"
      :context="columnContext"
      :item="col"
      :parent-context="renderContext"
    >
      <slot :name="`header-${col}`" :column="col">
        <slot name="header" :column="col">
          <div class="app-table__th">{{ col }}</div>
        </slot>
      </slot>
    </AppRepeatItem>

    <!-- Тело: AppRepeatItem per row, #row слот получает cells компонент -->
    <AppRepeatItem
      v-for="(row, rowIndex) in rows"
      :key="getRowKey(row, rowIndex)"
      :context="rowContext"
      :item="row"
      :parent-context="renderContext"
    >
      <slot name="row" :cells="CellsRenderer">
        <div class="app-table__tr">
          <component :is="CellsRenderer" />
        </div>
      </slot>
    </AppRepeatItem>
  </div>
</template>

<style>
.app-table {
  display: grid;
  grid-template-columns: var(--app-table-columns, repeat(auto-fit, minmax(80px, 1fr)));
  border: 1px solid var(--app-table-border, #e0e4e8);
  border-radius: var(--app-table-radius, 8px);
  overflow: hidden;
  font-size: 13px;
  background: var(--app-table-bg, #ffffff);
}

.app-table__th {
  padding: 9px 12px;
  font-weight: 600;
  color: var(--app-table-th-color, #475467);
  background: var(--app-table-th-bg, #f8fafc);
  border-bottom: 1px solid var(--app-table-border, #e0e4e8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-table__tr {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  border-bottom: 1px solid var(--app-table-row-border, #f0f3f6);
}

.app-table__tr:last-child {
  border-bottom: 0;
}

.app-table__tr:hover {
  background: var(--app-table-row-hover, #f8fafc);
}

.app-table__td {
  padding: 9px 12px;
  color: var(--app-table-td-color, #202124);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
