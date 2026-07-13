import type { Store } from '../types/store'
import { normalizeStoreKey } from '../utils/keys'
import type {
	EntityListContract,
	MappedListContract,
	MappedListOptions,
	RuntimeKey,
} from './mapped-list.types'

export class MappedList<TEntity, TId extends string = string>
	implements MappedListContract<TEntity, TId>
{
	private static readonly ALL_ENTITIES_KEY = '__MappedList:all__'
	private static readonly LIST_KEYS_KEY = '__MappedList:listKeys__'

	private readonly listInstances = new Map<
		string,
		EntityListContract<TEntity, TId>
	>()

	constructor(
		private readonly options: MappedListOptions<TEntity, TId>,
		private readonly entityStore: Store<TEntity>,
		private readonly listIdsStore: Store<readonly TId[]>,
	) {}

	set(entity: TEntity): void {
		const id = this.options.getId(entity)
		this.entityStore.set(entity, id)
		this.addToAllEntities(id)
	}

	setMany(entities: readonly TEntity[]): void {
		for (const entity of entities) {
			this.set(entity)
		}
	}

	get(id: TId): TEntity | undefined {
		return this.entityStore.get(id)
	}

	has(id: TId): boolean {
		return this.entityStore.has(id)
	}

	delete(id: TId): void {
		this.entityStore.delete(id)
		const current = this.listIdsStore.get(MappedList.ALL_ENTITIES_KEY) ?? []
		this.listIdsStore.set(
			current.filter((i) => i !== id),
			MappedList.ALL_ENTITIES_KEY,
		)

		for (const list of this.listInstances.values()) {
			list.remove(id)
		}
	}

	clear(): void {
		this.entityStore.clear()
		this.listIdsStore.clear()
		this.listInstances.clear()
	}

	values(): readonly TEntity[] {
		const ids =
			(this.listIdsStore.get(
				MappedList.ALL_ENTITIES_KEY,
			) as readonly TId[] | undefined) ?? []
		return ids
			.map((id) => this.entityStore.get(id))
			.filter((entity): entity is TEntity => entity !== undefined)
	}

	list(key?: RuntimeKey): EntityListContract<TEntity, TId> {
		const normalizedKey = normalizeStoreKey(key)
		const existingList = this.listInstances.get(normalizedKey)

		if (existingList !== undefined) {
			return existingList
		}

		const list = new EntityList<TEntity, TId>(
			this.options,
			key,
			this.entityStore,
			this.listIdsStore,
			(id) => this.addToAllEntities(id),
		)
		this.listInstances.set(normalizedKey, list)
		this.addToListKeys(normalizedKey)
		return list
	}

	listKeys(): readonly string[] {
		return (
			(this.listIdsStore.get(
				MappedList.LIST_KEYS_KEY,
			) as unknown as readonly string[]) ?? []
		)
	}

	hasList(key?: RuntimeKey): boolean {
		return this.listInstances.has(normalizeStoreKey(key))
	}

	deleteList(key?: RuntimeKey): void {
		const normalizedKey = normalizeStoreKey(key)
		this.listIdsStore.delete(key)
		this.listInstances.delete(normalizedKey)
		const current = this.listKeys()
		if (current.includes(normalizedKey)) {
			this.listIdsStore.set(
				current.filter((k) => k !== normalizedKey) as unknown as readonly TId[],
				MappedList.LIST_KEYS_KEY,
			)
		}
	}

	clearLists(): void {
		for (const list of this.listInstances.values()) {
			this.listIdsStore.delete(list.key)
		}
		this.listInstances.clear()
		this.listIdsStore.delete(MappedList.LIST_KEYS_KEY)
	}

	private addToListKeys(normalizedKey: string): void {
		const current = this.listKeys()
		if (!current.includes(normalizedKey)) {
			this.listIdsStore.set(
				[...current, normalizedKey] as unknown as readonly TId[],
				MappedList.LIST_KEYS_KEY,
			)
		}
	}

	private addToAllEntities(id: TId): void {
		const current = this.listIdsStore.get(MappedList.ALL_ENTITIES_KEY) ?? []
		if (!current.includes(id)) {
			this.listIdsStore.set([...current, id], MappedList.ALL_ENTITIES_KEY)
		}
	}
}

class EntityList<TEntity, TId extends string = string>
	implements EntityListContract<TEntity, TId>
{
	constructor(
		private readonly options: MappedListOptions<TEntity, TId>,
		readonly key: RuntimeKey | undefined,
		private readonly entityStore: Store<TEntity>,
		private readonly listIdsStore: Store<readonly TId[]>,
		private readonly onEntitySet: (id: TId) => void,
	) {}

	set(entities: readonly TEntity[]): void {
		const ids = entities.map((entity) => {
			const id = this.options.getId(entity)
			this.entityStore.set(entity, id)
			this.onEntitySet(id)
			return id
		})
		this.setIds(ids)
	}

	setIds(ids: readonly TId[]): void {
		const nextIds = this.unique(ids)
		this.assertExisting(nextIds)
		this.listIdsStore.set(nextIds, this.key)
	}

	append(entities: readonly TEntity[]): void {
		const ids = entities.map((entity) => {
			const id = this.options.getId(entity)
			this.entityStore.set(entity, id)
			this.onEntitySet(id)
			return id
		})
		this.appendIds(ids)
	}

	appendIds(ids: readonly TId[]): void {
		const currentIds = this.getIds()
		const nextIds = this.unique([...currentIds, ...ids])
		this.assertExisting(nextIds)
		this.listIdsStore.set(nextIds, this.key)
	}

	get(): readonly TEntity[] {
		return this.getIds()
			.map((id) => this.entityStore.get(id))
			.filter((entity): entity is TEntity => entity !== undefined)
	}

	getIds(): readonly TId[] {
		return this.listIdsStore.get(this.key) ?? []
	}

	has(id: TId): boolean {
		return this.getIds().includes(id)
	}

	remove(id: TId): void {
		const nextIds = this.getIds().filter((currentId) => currentId !== id)
		this.listIdsStore.set(nextIds, this.key)
	}

	clear(): void {
		this.listIdsStore.set([], this.key)
	}

	private unique(ids: readonly TId[]): readonly TId[] {
		return [...new Set(ids)]
	}

	private assertExisting(ids: readonly TId[]): void {
		for (const id of ids) {
			if (!this.entityStore.has(id)) {
				throw new Error(
					`${this.options.name} list cannot reference missing entity: ${id}`,
				)
			}
		}
	}
}
