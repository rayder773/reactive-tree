import { createUiRuntime, type UiRuntime } from '../../core/ui/UiRuntime'
import {
	type AppRuntime,
	createAppRuntime,
	createReactivityPlugin,
	type ListService,
} from '../../index'
import {
	createPartsRepository,
	type Part,
	type PartFilters,
	type PartRepository,
	type PartSortField,
	type PartsQuery,
} from './api'

export type { Part, PartFilters, PartSortField }

export class PartsExampleEnvironment {
	readonly app: AppRuntime
	readonly ui: UiRuntime
	readonly parts: ListService<Part>
	readonly repository: PartRepository

	constructor() {
		const reactivity = createReactivityPlugin()
		this.app = createAppRuntime({ plugins: [reactivity] })
		this.ui = createUiRuntime(reactivity)
		this.repository = createPartsRepository()

		const repository = this.repository
		this.parts = this.app
			.createListService<Part>({ name: 'Parts', getId: (p) => p.id })
			.withLoading()
			.withAbort()
			.withServerSorting<PartSortField>({
				name: 'PartsSorting',
				initial: { field: 'name', direction: 'asc' },
			})
			.withServerFilters<PartFilters>({
				name: 'PartsFilters',
				initial: () => ({}),
			})
			.withServerPagination()
			.withServerQuery(
				(params, signal) =>
					repository.queryParts(params as unknown as PartsQuery, signal),
				{ mapResponse: (r) => ({ items: r.items, total: r.total }) },
			)
			.withByIdsQuery((ids, signal) => repository.getPartsByIds(ids, signal))
			.build()
	}

	dispose(): void {
		this.app.dispose()
	}
}
