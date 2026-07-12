import { createApp } from 'vue'
import {
	type ButtonNode,
	createButtonUtility,
	createReactivityPlugin,
	createRepeatUtility,
	createTableUtility,
	createTextUtility,
	type ReactiveRef,
	type ReactivityPlugin,
	type RepeatNode,
	type TableColumn,
	type TableNode,
	type TextNode,
} from '../../index'
import type { ExampleDefinition, ExampleInstance } from '../types'
import { type Part, type PartFilters, PartsExampleEnvironment } from './data'
import PartList from './PartList.vue'

export interface PartsListView {
	readonly id: string
	readonly key: string
	readonly title: TextNode
	readonly status: TextNode
	readonly reloadButton: ButtonNode
	readonly nextPageButton: ButtonNode
	readonly sortButton: ButtonNode
	readonly filterButton: ButtonNode
	readonly clearFilterButton: ButtonNode
	readonly table: TableNode<unknown>
}

export interface PartListModel {
	readonly reactivity: ReactivityPlugin
	readonly createListButton: ButtonNode
	readonly listsRepeat: RepeatNode<unknown, unknown>
	readonly allLoadedTitle: TextNode
	readonly allLoadedPartsTable: TableNode<unknown>
	createPartsList(): void
	dispose(): void
}

const partListExample: ExampleDefinition = {
	id: 'part-list',
	title: 'Part List',
	description:
		'Runtime-bound UI nodes rendered by Vue over plain parts domain services.',
	mount({ element }): ExampleInstance {
		const reactivity = createReactivityPlugin()
		const environment = new PartsExampleEnvironment({
			plugins: [reactivity],
		})
		const model = createPartListModel(environment, reactivity)
		const app = createApp(PartList, { model })

		app.mount(element)

		return {
			dispose() {
				app.unmount()
				model.dispose()
				environment.dispose()
			},
		}
	},
}

export default partListExample

export function createPartListModel(
	environment: PartsExampleEnvironment,
	reactivity: ReactivityPlugin,
): PartListModel {
	const button = createButtonUtility(reactivity, { name: 'PartsButtons' })
	const text = createTextUtility(reactivity, { name: 'PartsTexts' })
	const repeat = createRepeatUtility(reactivity, { name: 'PartsRepeats' })
	const table = createTableUtility(reactivity, { name: 'PartsTables' })
	const lists = reactivity.ref<readonly PartsListView[]>([])
	const dataVersion = reactivity.ref(0)
	let nextListId = 1

	const createListButton = button({
		text: () => 'Create part list',
		disabled: () => false,
		onClick: () => createPartsList(),
	})
	const listsRepeat = repeat({
		items: () => lists.get(),
		key: (item) => (item as PartsListView).id,
		item: (item) => item,
	})
	const allLoadedTitle = text({
		value: () => {
			dataVersion.get()
			return `All loaded parts (${environment.partsDomain.getAllLoadedParts().length})`
		},
	})
	const allLoadedPartsTable = table({
		rows: () => {
			dataVersion.get()
			return environment.partsDomain.getAllLoadedParts()
		},
		columns: partColumns,
	})

	return {
		reactivity,
		createListButton,
		listsRepeat,
		allLoadedTitle,
		allLoadedPartsTable,
		createPartsList,
		dispose() {
			reactivity.dispose()
		},
	}

	function createPartsList(): void {
		const index = nextListId
		nextListId += 1

		const key = `parts:list:${index}`
		environment.pagination.setPageSize(2, key)
		environment.partsDomain.setSorting({ field: 'name', direction: 'asc' }, key)
		environment.partsDomain.setFilters({}, key)

		const view: PartsListView = {
			id: key,
			key,
			title: text({
				value: () => `Part list ${index}`,
			}),
			status: text({
				value: () => {
					const pagination = environment.pagination.get(key)
					const sorting = environment.sorting.get(key)
					const filters = environment.filters.get(key)

					return [
						`page ${pagination.page}`,
						`${pagination.total} total`,
						`sort ${sorting.field} ${sorting.direction}`,
						formatFilters(filters),
					].join(' | ')
				},
			}),
			reloadButton: button({
				text: () => 'Load',
				disabled: () => environment.loading.get(key) === 'loading',
				onClick: async () => {
					await environment.partsDomain.loadList(key)
					touchData(dataVersion)
				},
			}),
			nextPageButton: button({
				text: () => 'Next page',
				disabled: () => {
					const pagination = environment.pagination.get(key)
					return (
						environment.loading.get(key) === 'loading' ||
						pagination.page * pagination.pageSize >= pagination.total
					)
				},
				onClick: async () => {
					await environment.partsDomain.loadNextPage(key)
					touchData(dataVersion)
				},
			}),
			sortButton: button({
				text: () => {
					const sorting = environment.sorting.get(key)
					return sorting.direction === 'asc'
						? 'Sort price desc'
						: 'Sort name asc'
				},
				disabled: () => environment.loading.get(key) === 'loading',
				onClick: async () => {
					const sorting = environment.sorting.get(key)

					if (sorting.direction === 'asc') {
						environment.partsDomain.setSorting(
							{ field: 'price', direction: 'desc' },
							key,
						)
					} else {
						environment.partsDomain.setSorting(
							{ field: 'name', direction: 'asc' },
							key,
						)
					}

					await environment.partsDomain.loadList(key)
					touchData(dataVersion)
				},
			}),
			filterButton: button({
				text: () => 'Filter Northwind',
				disabled: () => environment.loading.get(key) === 'loading',
				onClick: async () => {
					environment.partsDomain.setFilters(
						{ manufacturer: 'Northwind Components' },
						key,
					)
					await environment.partsDomain.loadList(key)
					touchData(dataVersion)
				},
			}),
			clearFilterButton: button({
				text: () => 'Clear filters',
				disabled: () => environment.loading.get(key) === 'loading',
				onClick: async () => {
					environment.partsDomain.setFilters({}, key)
					await environment.partsDomain.loadList(key)
					touchData(dataVersion)
				},
			}),
			table: table({
				rows: () => {
					dataVersion.get()
					return environment.partsDomain.getList(key)
				},
				columns: partColumns,
			}),
		}

		lists.update((current) => [...current, view])
		void environment.partsDomain
			.loadList(key)
			.then(() => touchData(dataVersion))
	}
}

const partColumns: readonly TableColumn<Part>[] = [
	{
		id: 'id',
		header: 'ID',
		getValue: (part) => part.id,
	},
	{
		id: 'name',
		header: 'Name',
		getValue: (part) => part.name,
	},
	{
		id: 'manufacturer',
		header: 'Manufacturer',
		getValue: (part) => part.manufacturer,
	},
	{
		id: 'price',
		header: 'Price',
		getValue: (part) => `$${part.price}`,
	},
] as readonly TableColumn<Part>[]

function touchData(dataVersion: ReactiveRef<number>): void {
	dataVersion.update((version) => version + 1)
}

function formatFilters(filters: PartFilters): string {
	const entries = Object.entries(filters)

	if (entries.length === 0) {
		return 'no filters'
	}

	return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ')
}
