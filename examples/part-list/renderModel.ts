import { createApp } from 'vue'
import type {
	ButtonNode,
	ReactiveList,
	RepeatNode,
	TableColumn,
	TableNode,
	TextNode,
} from '../../index'
import type { ExampleDefinition, ExampleInstance } from '../types'
import { type Part, type PartFilters, PartsExampleEnvironment } from './data'
import PartList from './PartList.vue'

export interface PartListModel {
	readonly createListButton: ButtonNode
	readonly listsRepeat: RepeatNode<string>
	readonly allLoadedTitle: TextNode
	readonly allLoadedPartsTable: TableNode<Part>
	readonly partListTitle: TextNode
	readonly partListStatus: TextNode
	readonly partListReloadButton: ButtonNode
	readonly partListNextPageButton: ButtonNode
	readonly partListSortButton: ButtonNode
	readonly partListFilterButton: ButtonNode
	readonly partListClearFilterButton: ButtonNode
	readonly partListTable: TableNode<Part>
	readonly listKeys: ReactiveList<string>
	dispose(): void
}

const partListExample: ExampleDefinition = {
	id: 'part-list',
	title: 'Part List',
	description:
		'Runtime-bound UI nodes rendered by Vue over plain parts domain services.',
	mount({ element }): ExampleInstance {
		const environment = new PartsExampleEnvironment()
		const model = createPartListModel(environment)
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
): PartListModel {
	const { ui } = environment
	let nextListId = 1
	const listKeys = ui.createList<string>()

	const createListButton = ui.button('create-list', {
		text: () => 'Create part list',
		onClick: () => {
			const key = `parts:list:${nextListId++}`
			environment.pagination.setPageSize(2, key)
			environment.partsDomain.setSorting({ field: 'name', direction: 'asc' }, key)
			environment.partsDomain.setFilters({}, key)
			listKeys.append([key])
			void environment.partsDomain.loadList(key)
		},
	})

	const listsRepeat = ui.repeat('part-lists', {
		items: () => listKeys.get(),
		key: (k) => k,
	})

	const allLoadedTitle = ui.text('all-loaded-title', {
		value: () =>
			`All loaded parts (${environment.partsDomain.getAllLoadedParts().length})`,
	})

	const allLoadedPartsTable = ui.table('all-loaded-table', {
		rows: () => environment.partsDomain.getAllLoadedParts(),
		columns: partColumns,
	})

	const partListTitle = ui.text('part-list:title', {
		value: (key: string) => `Part list ${key}`,
	})

	const partListStatus = ui.text('part-list:status', {
		value: (key: string) => {
			const p = environment.pagination.get(key)
			const s = environment.sorting.get(key)
			const f = environment.filters.get(key)
			return [
				`page ${p.page}`,
				`${p.total} total`,
				`sort ${s.field} ${s.direction}`,
				formatFilters(f),
			].join(' | ')
		},
	})

	const partListReloadButton = ui.button('part-list:reload', {
		text: () => 'Load',
		disabled: (key: string) => environment.loading.get(key) === 'loading',
		onClick: async (key: string) => {
			await environment.partsDomain.loadList(key)
		},
	})

	const partListNextPageButton = ui.button('part-list:next-page', {
		text: () => 'Next page',
		disabled: (key: string) => {
			const p = environment.pagination.get(key)
			return (
				environment.loading.get(key) === 'loading' ||
				p.page * p.pageSize >= p.total
			)
		},
		onClick: async (key: string) => {
			await environment.partsDomain.loadNextPage(key)
		},
	})

	const partListSortButton = ui.button('part-list:sort', {
		text: (key: string) => {
			const s = environment.sorting.get(key)
			return s.direction === 'asc' ? 'Sort price desc' : 'Sort name asc'
		},
		disabled: (key: string) => environment.loading.get(key) === 'loading',
		onClick: async (key: string) => {
			const s = environment.sorting.get(key)
			environment.partsDomain.setSorting(
				s.direction === 'asc'
					? { field: 'price', direction: 'desc' }
					: { field: 'name', direction: 'asc' },
				key,
			)
			await environment.partsDomain.loadList(key)
		},
	})

	const partListFilterButton = ui.button('part-list:filter', {
		text: () => 'Filter Northwind',
		disabled: (key: string) => environment.loading.get(key) === 'loading',
		onClick: async (key: string) => {
			environment.partsDomain.setFilters(
				{ manufacturer: 'Northwind Components' },
				key,
			)
			await environment.partsDomain.loadList(key)
		},
	})

	const partListClearFilterButton = ui.button('part-list:clear-filter', {
		text: () => 'Clear filters',
		disabled: (key: string) => environment.loading.get(key) === 'loading',
		onClick: async (key: string) => {
			environment.partsDomain.setFilters({}, key)
			await environment.partsDomain.loadList(key)
		},
	})

	const partListTable = ui.table('part-list:table', {
		rows: (key: string) => environment.partsDomain.getList(key),
		columns: partColumns,
	})

	return {
		createListButton,
		listsRepeat,
		allLoadedTitle,
		allLoadedPartsTable,
		partListTitle,
		partListStatus,
		partListReloadButton,
		partListNextPageButton,
		partListSortButton,
		partListFilterButton,
		partListClearFilterButton,
		partListTable,
		listKeys,
		dispose() {},
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

function formatFilters(filters: PartFilters): string {
	const entries = Object.entries(filters)

	if (entries.length === 0) {
		return 'no filters'
	}

	return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ')
}
