import type { RuntimeKey } from '../../mapped-list/mapped-list.types'
import type { Store } from '../../types/store'
import type {
	FiltersServiceContract,
	FiltersServiceOptions,
} from './filters-service.types'

export class FiltersService<TFilters extends Record<string, unknown>>
	implements FiltersServiceContract<TFilters>
{
	constructor(
		private readonly store: Store<TFilters>,
		private readonly options: FiltersServiceOptions<TFilters>,
	) {}

	get(key?: RuntimeKey): TFilters {
		const existing = this.store.get(key)

		if (existing !== undefined) {
			return { ...existing }
		}

		const initial = this.createInitial()
		this.store.set(initial, key)
		return { ...initial }
	}

	set(value: TFilters, key?: RuntimeKey): void {
		this.store.set({ ...value }, key)
	}

	patch(value: Partial<TFilters>, key?: RuntimeKey): void {
		this.store.set({ ...this.get(key), ...value }, key)
	}

	reset(key?: RuntimeKey): void {
		this.store.set(this.createInitial(), key)
	}

	delete(key?: RuntimeKey): void {
		this.store.delete(key)
	}

	clear(): void {
		this.store.clear()
	}

	private createInitial(): TFilters {
		const initial =
			typeof this.options.initial === 'function'
				? this.options.initial()
				: this.options.initial
		return { ...initial }
	}
}
