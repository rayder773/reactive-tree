import type { RuntimeKey } from '../../mapped-list/mapped-list.types'

export type SortDirection = 'asc' | 'desc'

export interface SortingState<TField extends string> {
	field: TField
	direction: SortDirection
}

export interface SortingServiceOptions<TField extends string> {
	name?: string
	initial: SortingState<TField> | (() => SortingState<TField>)
}

export interface SortingServiceContract<TField extends string> {
	get(key?: RuntimeKey): SortingState<TField>
	set(value: SortingState<TField>, key?: RuntimeKey): void
	setField(field: TField, key?: RuntimeKey): void
	setDirection(direction: SortDirection, key?: RuntimeKey): void
	reset(key?: RuntimeKey): void
	delete(key?: RuntimeKey): void
	clear(): void
}
