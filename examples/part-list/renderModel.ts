import { createApp } from 'vue'
import type {
	ButtonNode,
	ContextNode,
	RenderContexts,
	RepeatNode,
	TableColumn,
	TableNode,
	TextNode,
} from '../../index'
import type { ExampleDefinition, ExampleInstance } from '../types'
import { type Part, type PartFilters, PartsExampleEnvironment } from './data'
import PartList from './PartList.vue'

export interface PartListModel {
	readonly partsContext: ContextNode<PartsContext>
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

	const partsContext = ui.context<PartsContext>('parts', () => ({
		get allLoadedParts() {
			return environment.partsDomain.getAllLoadedParts()
		},
		get listKeys() {
			return environment.parts.listKeys()
		},
		createList() {
			const key = getNextListKey(environment.parts.listKeys())
			environment.pagination.setPageSize(2, key)
			environment.partsDomain.setSorting(
				{ field: 'name', direction: 'asc' },
				key,
			)
			environment.partsDomain.setFilters({}, key)
			void environment.partsDomain.loadList(key)
		},
	}))

	const partListContext = ui.context<PartListContext, string>(
		'partList',
		({ item }) => {
			return {
				get id() {
					return item
				},
				get title() {
					return `Part list ${item}`
				},
				get status() {
					const p = environment.pagination.get(item)
					const s = environment.sorting.get(item)
					const f = environment.filters.get(item)
					return [
						`page ${p.page}`,
						`${p.total} total`,
						`sort ${s.field} ${s.direction}`,
						formatFilters(f),
					].join(' | ')
				},
				get rows() {
					return environment.partsDomain.getList(item)
				},
				get sortButtonText() {
					const s = environment.sorting.get(item)
					return s.direction === 'asc' ? 'Sort price desc' : 'Sort name asc'
				},
				get isLoading() {
					return environment.loading.get(item) === 'loading'
				},
				get canLoadNextPage() {
					const p = environment.pagination.get(item)
					return p.page * p.pageSize < p.total
				},
				async reload() {
					await environment.partsDomain.loadList(item)
				},
				async loadNextPage() {
					await environment.partsDomain.loadNextPage(item)
				},
				async toggleSorting() {
					const s = environment.sorting.get(item)
					environment.partsDomain.setSorting(
						s.direction === 'asc'
							? { field: 'price', direction: 'desc' }
							: { field: 'name', direction: 'asc' },
						item,
					)
					await environment.partsDomain.loadList(item)
				},
				async filterNorthwind() {
					environment.partsDomain.setFilters(
						{ manufacturer: 'Northwind Components' },
						item,
					)
					await environment.partsDomain.loadList(item)
				},
				async clearFilters() {
					environment.partsDomain.setFilters({}, item)
					await environment.partsDomain.loadList(item)
				},
			}
		},
	)

	const createListButton = ui.button('create-list', {
		text: () => 'Create part list',
		onClick: ({ contexts }) => getPartsContext(contexts).createList(),
	})

	const listsRepeat = ui.repeat('part-lists', {
		items: ({ contexts }) => getPartsContext(contexts).listKeys,
		key: (k) => k,
		context: partListContext,
	})

	const allLoadedTitle = ui.text('all-loaded-title', {
		value: ({ contexts }) =>
			`All loaded parts (${getPartsContext(contexts).allLoadedParts.length})`,
	})

	const allLoadedPartsTable = ui.table('all-loaded-table', {
		rows: ({ contexts }) => getPartsContext(contexts).allLoadedParts,
		columns: partColumns,
	})

	const partListTitle = ui.text('part-list:title', {
		value: ({ contexts }) => getPartListContext(contexts).title,
	})

	const partListStatus = ui.text('part-list:status', {
		value: ({ contexts }) => getPartListContext(contexts).status,
	})

	const partListReloadButton = ui.button('part-list:reload', {
		text: () => 'Load',
		disabled: ({ contexts }) => getPartListContext(contexts).isLoading,
		onClick: ({ contexts }) => getPartListContext(contexts).reload(),
	})

	const partListNextPageButton = ui.button('part-list:next-page', {
		text: () => 'Next page',
		disabled: ({ contexts }) => {
			const partList = getPartListContext(contexts)
			return partList.isLoading || !partList.canLoadNextPage
		},
		onClick: ({ contexts }) => getPartListContext(contexts).loadNextPage(),
	})

	const partListSortButton = ui.button('part-list:sort', {
		text: ({ contexts }) => getPartListContext(contexts).sortButtonText,
		disabled: ({ contexts }) => getPartListContext(contexts).isLoading,
		onClick: ({ contexts }) => getPartListContext(contexts).toggleSorting(),
	})

	const partListFilterButton = ui.button('part-list:filter', {
		text: () => 'Filter Northwind',
		disabled: ({ contexts }) => getPartListContext(contexts).isLoading,
		onClick: ({ contexts }) => getPartListContext(contexts).filterNorthwind(),
	})

	const partListClearFilterButton = ui.button('part-list:clear-filter', {
		text: () => 'Clear filters',
		disabled: ({ contexts }) => getPartListContext(contexts).isLoading,
		onClick: ({ contexts }) => getPartListContext(contexts).clearFilters(),
	})

	const partListTable = ui.table('part-list:table', {
		rows: ({ contexts }) => getPartListContext(contexts).rows,
		columns: partColumns,
	})

	return {
		partsContext,
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
		dispose() {},
	}
}

interface PartsContext {
	readonly listKeys: readonly string[]
	readonly allLoadedParts: readonly Part[]
	createList(): void
}

interface PartListContext {
	readonly id: string
	readonly title: string
	readonly status: string
	readonly rows: readonly Part[]
	readonly sortButtonText: string
	readonly isLoading: boolean
	readonly canLoadNextPage: boolean
	reload(): Promise<void>
	loadNextPage(): Promise<void>
	toggleSorting(): Promise<void>
	filterNorthwind(): Promise<void>
	clearFilters(): Promise<void>
}

function getPartsContext(contexts: RenderContexts): PartsContext {
	return contexts.parts as PartsContext
}

function getPartListContext(contexts: RenderContexts): PartListContext {
	return contexts.partList as PartListContext
}

function getNextListKey(keys: readonly string[]): string {
	const nextNumber =
		keys.reduce((max, key) => {
			const match = /^parts:list:(\d+)$/.exec(key)
			if (match === null) return max
			return Math.max(max, Number(match[1]))
		}, 0) + 1

	return `parts:list:${nextNumber}`
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
