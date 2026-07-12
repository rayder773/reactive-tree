<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import {
	AppButton,
	AppRepeat,
	AppTable,
	AppText,
} from '../../core/render-adapters/vue'
import type { PartListModel } from './renderModel'

export default defineComponent({
	name: 'PartList',
	components: {
		AppButton,
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
})
</script>

<template>
	<div class="parts-ui">
		<div class="parts-ui__toolbar">
			<AppButton
				:node="model.createListButton"
				class="parts-ui__primary-button"
			/>
		</div>

		<section class="parts-ui__section">
			<AppRepeat :node="model.listsRepeat">
				<template #default="{ node }">
					<article class="parts-list">
						<header class="parts-list__header">
							<h3>
								<AppText :node="node.title" />
							</h3>
							<p>
								<AppText :node="node.status" />
							</p>
						</header>

						<div class="parts-list__actions">
							<AppButton :node="node.reloadButton" />
							<AppButton :node="node.nextPageButton" />
							<AppButton :node="node.sortButton" />
							<AppButton :node="node.filterButton" />
							<AppButton :node="node.clearFilterButton" />
						</div>

						<AppTable
							:node="node.table"
							class="parts-table"
						/>
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
				class="parts-table"
			/>
		</section>
	</div>
</template>
