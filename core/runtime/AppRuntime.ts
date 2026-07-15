import type { ListServiceOptions } from '../list-service/list-service.types'
import {
	createListServiceBuilder,
	type ListServiceBuilder,
} from '../list-service/list-service-builder'
import { MappedList } from '../mapped-list/mapped-list'
import type { MappedListOptions } from '../mapped-list/mapped-list.types'
import { AbortService } from '../services/AbortService'
import { FiltersService } from '../services/filters/filters-service'
import type { FiltersServiceOptions } from '../services/filters/filters-service.types'
import { LoadingService } from '../services/LoadingService'
import { PaginationService } from '../services/PaginationService'
import { SortingService } from '../services/sorting/sorting-service'
import type {
	SortingServiceOptions,
	SortingState,
} from '../services/sorting/sorting-service.types'
import { Store } from '../store/Store'
import type { RuntimePlugin, StoreEventContext } from '../types/lifecycle'
import type { AppRuntimeOptions, CreateStoreOptions } from '../types/runtime'
import type { Store as StoreContract, StoreKey } from '../types/store'
import { normalizeStoreKey } from '../utils/keys'

const PROXY_MARKER = Symbol('AppRuntime.proxy')

type MethodName = keyof RuntimePlugin

export class AppRuntime {
	private readonly plugins: readonly RuntimePlugin[]
	private readonly proxies = new WeakMap<object, object>()
	private disposed = false

	constructor(options: AppRuntimeOptions = {}) {
		this.plugins = options.plugins ?? []
	}

	createStore<T>(_options: CreateStoreOptions = {}): StoreContract<T> {
		const store = new Store<T>()
		const wrapped = this.wrapStore(store)
		return wrapped
	}

	createLoadingService(
		store = this.createStore<LoadingStatus>({ name: 'LoadingStore' }),
	) {
		return new LoadingService(store)
	}

	createAbortService(
		store = this.createStore<AbortController>({ name: 'AbortStore' }),
	) {
		return new AbortService(store)
	}

	createPaginationService(
		store = this.createStore<PaginationState>({ name: 'PaginationStore' }),
	) {
		return new PaginationService(store)
	}

	createMappedList<TEntity, TId extends string = string>(
		options: MappedListOptions<TEntity, TId>,
	) {
		const entityStore = this.createStore<TEntity>({
			name: `${options.name}.Entities`,
		})
		const listIdsStore = this.createStore<readonly TId[]>({
			name: `${options.name}.Lists`,
		})
		return new MappedList<TEntity, TId>(options, entityStore, listIdsStore)
	}

	createSortingService<TField extends string>(
		options: SortingServiceOptions<TField>,
	) {
		const store = this.createStore<SortingState<TField>>({
			name: `${options.name ?? 'SortingService'}.Store`,
		})
		return new SortingService(store, options)
	}

	createListService<TEntity, TId extends string = string>(
		options: ListServiceOptions<TEntity, TId>,
	): ListServiceBuilder<TEntity, TId> {
		const mappedList = this.createMappedList<TEntity, TId>(options)
		return createListServiceBuilder<TEntity, TId>(this, options, mappedList)
	}

	createFiltersService<TFilters extends Record<string, unknown>>(
		options: FiltersServiceOptions<TFilters>,
	) {
		const store = this.createStore<TFilters>({
			name: `${options.name ?? 'FiltersService'}.Store`,
		})
		return new FiltersService(store, options)
	}

	dispose(): void {
		if (this.disposed) {
			return
		}

		this.disposed = true
	}

	private wrapStore<T>(store: Store<T>): StoreContract<T> {
		const existingProxy = this.proxies.get(store)

		if (existingProxy !== undefined) {
			return existingProxy as StoreContract<T>
		}

		const runtime = this
		const proxy = new Proxy(store, {
			get(target, property, receiver) {
				if (property === PROXY_MARKER) {
					return target
				}

				const value = Reflect.get(target, property, receiver)

				if (typeof property !== 'string' || typeof value !== 'function') {
					return value
				}

				if (!isStoreMethod(property)) {
					return value.bind(target)
				}

				return (...args: unknown[]) =>
					runtime.callStoreMethod(target, property, value, args)
			},
		})

		this.proxies.set(store, proxy)
		return proxy
	}

	private callStoreMethod<T>(
		store: Store<T>,
		method: StoreMethod,
		fn: (...args: unknown[]) => unknown,
		args: readonly unknown[],
	): unknown {
		const key =
			method === 'clear'
				? undefined
				: (args[method === 'set' ? 1 : 0] as StoreKey)
		const value = method === 'set' ? args[0] : undefined
		const normalizedKey = normalizeStoreKey(key)
		const context: StoreEventContext = {
			store,
			method,
			key,
			normalizedKey,
			value,
		}

		this.emitStoreBefore(method, context)

		const result = Reflect.apply(fn, store, args)
		this.emitStoreAfter(method, { ...context, result })
		return result
	}

	private emitStoreBefore(
		method: StoreMethod,
		context: StoreEventContext,
	): void {
		if (method === 'set') {
			this.emit('beforeStoreSet', context)
			return
		}

		if (method === 'delete') {
			this.emit('beforeStoreDelete', context)
			return
		}

		if (method === 'clear') {
			this.emit('beforeStoreClear', context)
			return
		}

		this.emit('beforeStoreGet', context)
	}

	private emitStoreAfter(
		method: StoreMethod,
		context: StoreEventContext,
	): void {
		if (method === 'set') {
			this.emit('afterStoreSet', context)
			return
		}

		if (method === 'delete') {
			this.emit('afterStoreDelete', context)
			return
		}

		if (method === 'clear') {
			this.emit('afterStoreClear', context)
			return
		}

		this.emit('afterStoreGet', context)
	}

	private emit(method: 'beforeStoreGet', context: StoreEventContext): void
	private emit(method: 'afterStoreGet', context: StoreEventContext): void
	private emit(method: 'beforeStoreSet', context: StoreEventContext): void
	private emit(method: 'afterStoreSet', context: StoreEventContext): void
	private emit(method: 'beforeStoreDelete', context: StoreEventContext): void
	private emit(method: 'afterStoreDelete', context: StoreEventContext): void
	private emit(method: 'beforeStoreClear', context: StoreEventContext): void
	private emit(method: 'afterStoreClear', context: StoreEventContext): void
	private emit(method: MethodName, context: object): void {
		for (const plugin of this.plugins) {
			const hook = plugin[method]

			if (typeof hook !== 'function') {
				continue
			}

			try {
				;(hook as (this: RuntimePlugin, context: object) => void).call(
					plugin,
					context,
				)
			} catch (error) {
				console.error(error)
			}
		}
	}
}

type StoreMethod = 'get' | 'set' | 'delete' | 'has' | 'clear'

function isStoreMethod(method: string): method is StoreMethod {
	return (
		method === 'get' ||
		method === 'set' ||
		method === 'delete' ||
		method === 'has' ||
		method === 'clear'
	)
}

type LoadingStatus =
	ConstructorParameters<typeof LoadingService>[0] extends StoreContract<infer T>
		? T
		: never

type PaginationState =
	ConstructorParameters<typeof PaginationService>[0] extends StoreContract<
		infer T
	>
		? T
		: never
