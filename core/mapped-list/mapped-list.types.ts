import type { StoreKey } from '../types/store'

export type RuntimeKey = StoreKey

export interface MappedListOptions<TEntity, TId extends string = string> {
	name: string
	getId(entity: TEntity): TId
}

export interface MappedListContract<TEntity, TId extends string = string> {
	set(entity: TEntity): void
	setMany(entities: readonly TEntity[]): void
	get(id: TId): TEntity | undefined
	has(id: TId): boolean
	delete(id: TId): void
	clear(): void
	values(): readonly TEntity[]
	list(key?: RuntimeKey): EntityListContract<TEntity, TId>
	listKeys(): readonly string[]
	hasList(key?: RuntimeKey): boolean
	deleteList(key?: RuntimeKey): void
	clearLists(): void
}

export interface EntityListContract<TEntity, TId extends string = string> {
	readonly key: RuntimeKey | undefined
	set(entities: readonly TEntity[]): void
	setIds(ids: readonly TId[]): void
	append(entities: readonly TEntity[]): void
	appendIds(ids: readonly TId[]): void
	get(): readonly TEntity[]
	getIds(): readonly TId[]
	has(id: TId): boolean
	remove(id: TId): void
	clear(): void
}
