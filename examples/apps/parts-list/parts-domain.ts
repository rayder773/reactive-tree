import {
	copies,
	entityLists,
	entityStore,
	identity,
	query,
	queryConcurrencyLatest,
	queryFiltering,
	queryLoading,
	queryPagination,
	querySorting,
	selection,
} from '../../../core'
import { createPartsRepository, type PartRepository } from './api'
import type { Part, PartFilters, PartSortField } from './parts.types'

interface ManufacturerArgs {
	manufacturer: Part['manufacturer']
}

const partsQuery = (
	repository: PartRepository,
	filters: PartFilters,
	sorting: { field: PartSortField; direction: 'asc' | 'desc' },
) =>
	query<Part>()
		.use(queryLoading())
		.use(queryConcurrencyLatest({ cancelPrevious: true }))
		.use(querySorting<PartSortField>(sorting))
		.use(queryFiltering<PartFilters>(filters))
		.use(queryPagination({ pageSize: 100 }))
		.request(async ({ signal, filtering, pagination, sorting }) => {
			const page = pagination.state.get()
			const response = await repository.queryParts(
				{
					offset: (page.page - 1) * page.pageSize,
					limit: page.pageSize,
					sorting: sorting.state.get(),
					filters: filtering.state.get(),
				},
				signal,
			)
			pagination.setTotal(response.total)
			return response.items
		})

export function createPartsDomain() {
	const repository = createPartsRepository()
	const entities = entityStore<Part>()
		.use(identity((part) => part.id))
		.build()
	const lists = entityLists(entities)

	const allParts = lists
		.create('all-parts')
		.use(
			partsQuery(
				repository,
				{ manufacturer: null },
				{ field: 'name', direction: 'asc' },
			),
		)
		.use(selection({ mode: 'multiple' }))
		.build()

	const northwindView = lists
		.create<ManufacturerArgs>('manufacturer-view')
		.use((args) =>
			partsQuery(
				repository,
				{ manufacturer: args.manufacturer },
				{ field: 'price', direction: 'asc' },
			),
		)
		.use(selection({ mode: 'single' }))
		.use(copies())
		.build({ manufacturer: 'Northwind' })

	const ready = Promise.all([
		allParts.query.replace(),
		northwindView.query.replace(),
	]).then(
		() => undefined,
		() => undefined,
	)

	return {
		repository,
		entities,
		lists,
		ready,
		allParts,
		northwindView,
		manufacturerViews: northwindView.copies,
		manufacturers: ['Northwind', 'Contoso', 'Adventure Works'] as const,
		increasePrice(id: number) {
			entities.update(id, (part) => ({
				...part,
				price: Math.round((part.price + 1) * 100) / 100,
			}))
		},
		deletePart(id: number) {
			entities.delete(id)
		},
		async toggleAllSort() {
			const current = allParts.query.sorting.state.get()
			allParts.query.sorting.setDirection(
				current.direction === 'asc' ? 'desc' : 'asc',
			)
			await allParts.query.replace().catch(() => undefined)
		},
		createManufacturerView(manufacturer: Part['manufacturer']) {
			const view = northwindView.copies.create(manufacturer, { manufacturer })
			void view.query.replace().catch(() => undefined)
			return view
		},
		deleteManufacturerView(manufacturer: PartFilters['manufacturer']) {
			return manufacturer && manufacturer !== 'Northwind'
				? northwindView.copies.delete(manufacturer)
				: false
		},
		dispose() {
			lists.dispose()
			entities.dispose()
		},
	}
}

export type PartsDomain = ReturnType<typeof createPartsDomain>
export type ManufacturerView =
	| PartsDomain['northwindView']
	| ReturnType<PartsDomain['manufacturerViews']['items']['get']>[number]
