<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import {
	AppButton,
	AppContext,
	AppRepeat,
	AppTable,
	AppText,
} from '../../core/render-adapters/vue'
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
	</AppContext>
</template>
