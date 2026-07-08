import {
	asyncNode,
	createEntityList,
	createEntityStore,
	createTree,
	defineAsync,
	paginate,
	state,
	withActions,
} from '../../../../../src'
import { error, success } from '../../../../../src/adapters/sim'

export interface Part {
	id: string
	mpn: string
	manufacturer: string
}

export interface SearchResult {
	items: Part[]
	total: number
}

const ALL_PARTS: Part[] = [
	{ id: 'P001', mpn: 'LM358DR', manufacturer: 'Texas Instruments' },
	{ id: 'P002', mpn: 'NE555P', manufacturer: 'Texas Instruments' },
	{ id: 'P003', mpn: 'ATmega328P-PU', manufacturer: 'Microchip Technology' },
	{ id: 'P004', mpn: 'STM32F103C8T6', manufacturer: 'STMicroelectronics' },
	{ id: 'P005', mpn: 'ESP32-WROOM-32', manufacturer: 'Espressif Systems' },
	{ id: 'P006', mpn: 'MCP2551-I/P', manufacturer: 'Microchip Technology' },
	{ id: 'P007', mpn: 'TL072CP', manufacturer: 'Texas Instruments' },
	{ id: 'P008', mpn: 'MAX232CPE+', manufacturer: 'Maxim Integrated' },
	{ id: 'P009', mpn: 'LM7805CT', manufacturer: 'Fairchild Semiconductor' },
	{ id: 'P010', mpn: 'SN74HC595N', manufacturer: 'Texas Instruments' },
	{ id: 'P011', mpn: 'CD4051BE', manufacturer: 'Texas Instruments' },
	{ id: 'P012', mpn: 'ULN2003AN', manufacturer: 'STMicroelectronics' },
	{ id: 'P013', mpn: 'DS18B20+', manufacturer: 'Maxim Integrated' },
	{ id: 'P014', mpn: 'IRLZ44NPBF', manufacturer: 'Vishay Intertechnology' },
	{ id: 'P015', mpn: 'MCP3208-CI/P', manufacturer: 'Microchip Technology' },
	{ id: 'P016', mpn: 'ACS712ELCTR-30A-T', manufacturer: 'Allegro MicroSystems' },
	{ id: 'P017', mpn: 'HC-SR04', manufacturer: 'Generic' },
	{ id: 'P018', mpn: 'BMP280', manufacturer: 'Bosch Sensortec' },
	{ id: 'P019', mpn: 'MPU-6050', manufacturer: 'InvenSense' },
	{ id: 'P020', mpn: 'W25Q128JVSIQ', manufacturer: 'Winbond Electronics' },
	{ id: 'P021', mpn: 'RP2040', manufacturer: 'Raspberry Pi Ltd' },
	{ id: 'P022', mpn: 'ATMEGA2560-16AU', manufacturer: 'Microchip Technology' },
	{ id: 'P023', mpn: 'LTC3780EGN#PBF', manufacturer: 'Analog Devices' },
	{ id: 'P024', mpn: 'TPS62130RGTR', manufacturer: 'Texas Instruments' },
	{ id: 'P025', mpn: 'INA219AIDR', manufacturer: 'Texas Instruments' },
]

interface SearchParams {
	query?: string
	sortBy?: string
	sortDir?: string
	page?: number
	pageSize?: number
	[key: string]: unknown
}

function simulateSearch(params: SearchParams): SearchResult {
	const query = (params.query ?? '').toLowerCase().trim()

	const filtered = query
		? ALL_PARTS.filter(
				(p) =>
					p.id.toLowerCase().includes(query) ||
					p.mpn.toLowerCase().includes(query) ||
					p.manufacturer.toLowerCase().includes(query),
			)
		: ALL_PARTS

	const sortBy = params.sortBy ?? 'mpn'
	const sortDir = params.sortDir ?? 'asc'
	const sorted = [...filtered].sort((a, b) => {
		const av = a[sortBy as keyof Part] ?? ''
		const bv = b[sortBy as keyof Part] ?? ''
		const cmp = String(av).localeCompare(String(bv))
		return sortDir === 'desc' ? -cmp : cmp
	})

	const page = params.page ?? 0
	const pageSize = params.pageSize ?? 50
	const items = sorted.slice(page * pageSize, (page + 1) * pageSize)

	return { items, total: sorted.length }
}

const sortBy = withActions(
	state<string>('mpn', { label: 'Sort by' }),
	{},
)

const sortDir = withActions(
	state<'asc' | 'desc'>('asc', { label: 'Sort direction' }),
	{ toggle: (self) => self.set(self.value === 'asc' ? 'desc' : 'asc') },
)

const searchParts = defineAsync(
	asyncNode<SearchResult, SearchParams>({ label: 'Search parts' }),
	{
		fetch: async (params, _signal) => simulateSearch(params),
		scenarios: {
			success: success<SearchResult>({ items: ALL_PARTS.slice(0, 10), total: 25 }, { delay: 500 }),
			empty: success<SearchResult>({ items: [], total: 0 }, { delay: 300 }),
			error: error('Search service unavailable', { status: 503 }),
		},
	},
)

export const searchList = createEntityList({
	listState: {
		filters: {
			query: withActions(
				state<string>('', { label: 'Search query' }),
				{ clear: (self) => self.set('') },
			),
		},
		sorting: {
			by: sortBy,
			dir: sortDir,
		},
		pagination: paginate('page', {
			pageSize: 10,
			fields: {
				request: { page: 'page', pageSize: 'pageSize' },
				response: { total: 'total' },
			},
		}),
	},

	trigger: (self) => {
		const query = self.listState.filters.query.value
		if (!query) return null
		return { query }
	},

	fetch: searchParts,
	stores: { parts: createEntityStore<Part>() },

	onFetch: (result, _self, { parts }) => {
		parts.merge(result.items, (p) => p.id)
		return result.items.map((p) => p.id)
	},

	fetchMode: 'append',
})

export const tree = createTree({
	results: searchList,
})
