import { createApp } from 'vue'
import type {
	ButtonNode,
	ContextNode,
	RepeatNode,
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
	readonly allLoadedPartsTable: TableNode<string>
	readonly partListTitle: TextNode
	readonly partListStatus: TextNode
	readonly partListReloadButton: ButtonNode
	readonly partListNextPageButton: ButtonNode
	readonly partListSortButton: ButtonNode
	readonly partListFilterButton: ButtonNode
	readonly partListClearFilterButton: ButtonNode
	readonly partListTable: TableNode<string>
	readonly partCellId: TextNode
	readonly partCellName: TextNode
	readonly partCellManufacturer: TextNode
	readonly partCellPrice: TextNode
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

export function createPartListModel(environment: PartsExampleEnvironment): PartListModel {
	const { ui } = environment

	const partsContext = ui.context<PartsContext>('parts', () => ({
		get allLoadedParts() {
			return environment.parts.values()
		},
		get listKeys() {
			return environment.parts.listKeys()
		},
		createList() {
			const key = getNextListKey(environment.parts.listKeys())
			environment.parts.setPageSize(2, key)
			environment.parts.setSorting({ field: 'name', direction: 'asc' }, key)
			environment.parts.setFilters({}, key)
			void environment.parts.loadList(key)
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
					const p = environment.parts.pagination(item)
					const s = environment.parts.sorting(item)
					const f = environment.parts.filters(item)
					return [
						`page ${p.page}`,
						`${p.total} total`,
						`sort ${s.field} ${s.direction}`,
						formatFilters(f as PartFilters),
					].join(' | ')
				},
				get rows() {
					return environment.parts.list(item).get()
				},
				get sortButtonText() {
					const s = environment.parts.sorting(item)
					return s.direction === 'asc' ? 'Sort price desc' : 'Sort name asc'
				},
				get isLoading() {
					return environment.parts.loading(item) === 'loading'
				},
				get canLoadNextPage() {
					const p = environment.parts.pagination(item)
					return p.page * p.pageSize < p.total
				},
				async reload() {
					await environment.parts.loadList(item)
				},
				async loadNextPage() {
					await environment.parts.loadNextPage(item)
				},
				async toggleSorting() {
					const s = environment.parts.sorting(item)
					environment.parts.setSorting(
						s.direction === 'asc'
							? { field: 'price', direction: 'desc' }
							: { field: 'name', direction: 'asc' },
						item,
					)
					await environment.parts.loadList(item)
				},
				async filterNorthwind() {
					environment.parts.setFilters({ manufacturer: 'Northwind Components' }, item)
					await environment.parts.loadList(item)
				},
				async clearFilters() {
					environment.parts.setFilters({}, item)
					await environment.parts.loadList(item)
				},
			}
		},
	)

	const partRowContext = ui.context<PartRowContext, string>(
		'partRow',
		({ item: entityId }) => ({
			get id() {
				return entityId
			},
			get name() {
				return environment.parts.get(entityId)?.name ?? ''
			},
			get manufacturer() {
				return environment.parts.get(entityId)?.manufacturer ?? ''
			},
			get price() {
				const price = environment.parts.get(entityId)?.price
				return price !== undefined ? `$${price}` : ''
			},
		}),
	)

	const createListButton = ui.button('create-list', {
		text: () => 'Create part list',
		onClick: ({ contexts }) => partsContext.get(contexts).createList(),
	})

	const listsRepeat = ui.repeat('part-lists', {
		items: ({ contexts }) => partsContext.get(contexts).listKeys,
		key: (k) => k,
		context: partListContext,
	})

	const allLoadedTitle = ui.text('all-loaded-title', {
		value: ({ contexts }) =>
			`All loaded parts (${partsContext.get(contexts).allLoadedParts.length})`,
	})

	const allLoadedPartsTable = ui.table('all-loaded-table', {
		rows: ({ contexts }) =>
			partsContext.get(contexts).allLoadedParts.map((p) => p.id),
		columns: partColumns,
		rowContext: partRowContext,
		rowKey: (id) => id,
	})

	const partListTitle = ui.text('part-list:title', {
		value: ({ contexts }) => partListContext.get(contexts).title,
	})

	const partListStatus = ui.text('part-list:status', {
		value: ({ contexts }) => partListContext.get(contexts).status,
	})

	const partListReloadButton = ui.button('part-list:reload', {
		text: () => 'Load',
		disabled: ({ contexts }) => partListContext.get(contexts).isLoading,
		onClick: ({ contexts }) => partListContext.get(contexts).reload(),
	})

	const partListNextPageButton = ui.button('part-list:next-page', {
		text: () => 'Next page',
		disabled: ({ contexts }) => {
			const partList = partListContext.get(contexts)
			return partList.isLoading || !partList.canLoadNextPage
		},
		onClick: ({ contexts }) => partListContext.get(contexts).loadNextPage(),
	})

	const partListSortButton = ui.button('part-list:sort', {
		text: ({ contexts }) => partListContext.get(contexts).sortButtonText,
		disabled: ({ contexts }) => partListContext.get(contexts).isLoading,
		onClick: ({ contexts }) => partListContext.get(contexts).toggleSorting(),
	})

	const partListFilterButton = ui.button('part-list:filter', {
		text: () => 'Filter Northwind',
		disabled: ({ contexts }) => partListContext.get(contexts).isLoading,
		onClick: ({ contexts }) => partListContext.get(contexts).filterNorthwind(),
	})

	const partListClearFilterButton = ui.button('part-list:clear-filter', {
		text: () => 'Clear filters',
		disabled: ({ contexts }) => partListContext.get(contexts).isLoading,
		onClick: ({ contexts }) => partListContext.get(contexts).clearFilters(),
	})

	const partListTable = ui.table('part-list:table', {
		rows: ({ contexts }) => partListContext.get(contexts).rows.map((p) => p.id),
		columns: partColumns,
		rowContext: partRowContext,
		rowKey: (id) => id,
	})

	const partCellId = ui.text('part-cell:id', {
		value: ({ contexts }) => partRowContext.get(contexts).id,
	})

	const partCellName = ui.text('part-cell:name', {
		value: ({ contexts }) => partRowContext.get(contexts).name,
	})

	const partCellManufacturer = ui.text('part-cell:manufacturer', {
		value: ({ contexts }) => partRowContext.get(contexts).manufacturer,
	})

	const partCellPrice = ui.text('part-cell:price', {
		value: ({ contexts }) => partRowContext.get(contexts).price,
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
		partCellId,
		partCellName,
		partCellManufacturer,
		partCellPrice,
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

interface PartRowContext {
	readonly id: string
	readonly name: string
	readonly manufacturer: string
	readonly price: string
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

const partColumns = ['id', 'name', 'manufacturer', 'price'] as const

function formatFilters(filters: PartFilters): string {
	const entries = Object.entries(filters)

	if (entries.length === 0) {
		return 'no filters'
	}

	return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ')
}
