import type { RuntimeKey } from '../../mapped-list/mapped-list.types'
import type { Store } from '../../types/store'
import type {
	SortDirection,
	SortingServiceContract,
	SortingServiceOptions,
	SortingState,
} from './sorting-service.types'

export class SortingService<TField extends string>
	implements SortingServiceContract<TField>
{
	constructor(
		private readonly store: Store<SortingState<TField>>,
		private readonly options: SortingServiceOptions<TField>,
	) {}

	get(key?: RuntimeKey): SortingState<TField> {
		const existing = this.store.get(key)

		if (existing !== undefined) {
			return { ...existing }
		}

		const initial = this.createInitial()
		this.store.set(initial, key)
		return { ...initial }
	}

	set(value: SortingState<TField>, key?: RuntimeKey): void {
		this.store.set({ ...value }, key)
	}

	setField(field: TField, key?: RuntimeKey): void {
		this.set({ ...this.get(key), field }, key)
	}

	setDirection(direction: SortDirection, key?: RuntimeKey): void {
		this.set({ ...this.get(key), direction }, key)
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

	private createInitial(): SortingState<TField> {
		const initial =
			typeof this.options.initial === 'function'
				? this.options.initial()
				: this.options.initial
		return { ...initial }
	}
}
