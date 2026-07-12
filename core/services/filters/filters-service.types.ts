import type { RuntimeKey } from '../../mapped-list/mapped-list.types'

export interface FiltersServiceOptions<
	TFilters extends Record<string, unknown>,
> {
	name?: string
	initial: TFilters | (() => TFilters)
}

export interface FiltersServiceContract<
	TFilters extends Record<string, unknown>,
> {
	get(key?: RuntimeKey): TFilters
	set(value: TFilters, key?: RuntimeKey): void
	patch(value: Partial<TFilters>, key?: RuntimeKey): void
	reset(key?: RuntimeKey): void
	delete(key?: RuntimeKey): void
	clear(): void
}
