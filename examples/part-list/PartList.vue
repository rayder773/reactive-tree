<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import {
	AppButton,
	AppContext,
	AppRepeat,
	AppTable,
	AppText,
} from '../../core/render-adapters/vue'
import type { TextNode } from '../../index'
import type { PartListModel } from './renderModel'

export default defineComponent({
	name: 'PartList',
	components: {
		AppButton,
		AppContext,
		AppRepeat,
		AppTable,
		AppText,
	},
	props: {
		model: {
			type: Object as PropType<PartListModel>,
			required: true,
		},
	},
	setup(props) {
		const columnLabels: Record<string, string> = {
			id: 'ID',
			name: 'Name',
			manufacturer: 'Manufacturer',
			price: 'Price',
		}

		const cellNodes: Record<string, TextNode> = {
			id: props.model.partCellId,
			name: props.model.partCellName,
			manufacturer: props.model.partCellManufacturer,
			price: props.model.partCellPrice,
		}

		return { columnLabels, cellNodes }
	},
})
</script>

<template>
	<AppContext :context="model.partsContext">
		<div class="parts-ui">
			<div class="parts-ui__toolbar">
				<AppButton
					:node="model.createListButton"
					class="parts-ui__primary-button"
				/>
			</div>

			<section class="parts-ui__section">
				<AppRepeat :node="model.listsRepeat">
					<template #default>
						<article class="parts-list">
							<header class="parts-list__header">
								<h3>
									<AppText :node="model.partListTitle" />
								</h3>
								<p>
									<AppText :node="model.partListStatus" />
								</p>
							</header>

							<div class="parts-list__actions">
								<AppButton :node="model.partListReloadButton" />
								<AppButton :node="model.partListNextPageButton" />
								<AppButton :node="model.partListSortButton" />
								<AppButton :node="model.partListFilterButton" />
								<AppButton :node="model.partListClearFilterButton" />
							</div>

							<AppTable
								:node="model.partListTable"
								style="--app-table-columns: 100px 1fr 1fr 80px"
							>
								<template #header="{ column }">
									<div class="app-table__th">{{ columnLabels[column] }}</div>
								</template>
								<template #row="{ cells }">
									<div class="app-table__tr">
										<component :is="cells" />
									</div>
								</template>
								<template #cell="{ column }">
									<div class="app-table__td">
										<AppText :node="cellNodes[column]" />
									</div>
								</template>
							</AppTable>
						</article>
					</template>
				</AppRepeat>
			</section>

			<section class="parts-ui__section">
				<h3>
					<AppText :node="model.allLoadedTitle" />
				</h3>
				<AppTable
					:node="model.allLoadedPartsTable"
					style="--app-table-columns: 100px 1fr 1fr 80px"
				>
					<template #header="{ column }">
						<div class="app-table__th">{{ columnLabels[column] }}</div>
					</template>
					<template #row="{ cells }">
						<div class="app-table__tr">
							<component :is="cells" />
						</div>
					</template>
					<template #cell="{ column }">
						<div class="app-table__td">
							<AppText :node="cellNodes[column]" />
						</div>
					</template>
				</AppTable>
			</section>
		</div>
	</AppContext>
</template>
