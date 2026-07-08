import { button, createDisplayTree, input, listDisplay, text } from '../../../../../src'
import { tree } from './tree'

export const display = createDisplayTree(tree, (_, data) => ({
	searchInput: input({
		source: () => data.results.listState.filters.query,
	}),

	clearButton: button({
		text: '✕',
		display: () => data.results.listState.filters.query.value !== '',
		handlers: {
			click: data.results.listState.filters.query.clear,
		},
	}),

	sortByInput: input({
		source: () => data.results.listState.sorting.by,
		options: () => [
			{ value: 'mpn', label: 'MPN' },
			{ value: 'manufacturer', label: 'Manufacturer' },
			{ value: 'id', label: 'ID' },
		],
	}),

	sortDirButton: button({
		text: () => (data.results.listState.sorting.dir.value === 'asc' ? '↑' : '↓'),
		handlers: {
			click: data.results.listState.sorting.dir.toggle,
		},
	}),

	resultsList: listDisplay({
		source: () => data.results,
		virtualize: {
			windowSize: 15,
			rowHeight: 48,
			onReachEnd: () => {
				const pagination = data.results.listState.pagination
				if (
					pagination?._type === 'page' &&
					pagination.hasMore.value &&
					data.results.fetch.status !== 'loading'
				) {
					data.results.nextPage()
				}
			},
		},
		table: {
			columns: () => [
				{ id: 'mpn', text: 'MPN' },
				{ id: 'manufacturer', text: 'Manufacturer' },
			],
			rows: (id) => [
				{ id: `${id}-mpn`, text: text(() => data.results.parts.dict.value[id]?.mpn ?? '') },
				{ id: `${id}-manufacturer`, text: text(() => data.results.parts.dict.value[id]?.manufacturer ?? '') },
			],
		},
	}),
}))
