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
import type {
	AsyncEventContext,
	AsyncResultEventContext,
	CustomEventContext,
	MethodErrorEventContext,
	MethodEventContext,
	MethodResultEventContext,
	RegistrationEventContext,
	RuntimeErrorEventContext,
	RuntimeEventContext,
	RuntimePlugin,
	StoreEventContext,
} from '../types/lifecycle'
import type {
	AppRuntimeOptions,
	CreateStoreOptions,
	DependencyDeclarationOptions,
	DependencyTarget,
	RegisterOptions,
} from '../types/runtime'
import type { Store as StoreContract, StoreKey } from '../types/store'
import { normalizeStoreKey } from '../utils/keys'

const PROXY_MARKER = Symbol('AppRuntime.proxy')

type MethodName = keyof RuntimePlugin

export class AppRuntime {
	private readonly plugins: readonly RuntimePlugin[]
	private readonly names = new WeakMap<object, string>()
	private readonly proxies = new WeakMap<object, object>()
	private disposed = false

	constructor(options: AppRuntimeOptions = {}) {
		this.plugins = options.plugins ?? []
		this.emit('runtimeCreated', { runtime: this })
	}

	createStore<T>(options: CreateStoreOptions = {}): StoreContract<T> {
		const store = new Store<T>()
		const wrapped = this.wrapStore(store)
		this.register(wrapped, { name: options.name ?? 'Store' })
		return wrapped
	}

	createLoadingService(
		store = this.createStore<LoadingStatus>({ name: 'LoadingStore' }),
	) {
		const service = this.register(
			new LoadingService(store, this.executeAsync),
			{
				name: 'LoadingService',
			},
		)
		this.declareDependency(service, store, { type: 'uses' })
		return service
	}

	createAbortService(
		store = this.createStore<AbortController>({ name: 'AbortStore' }),
	) {
		const service = this.register(new AbortService(store, this.executeAsync), {
			name: 'AbortService',
		})
		this.declareDependency(service, store, { type: 'uses' })
		return service
	}

	createPaginationService(
		store = this.createStore<PaginationState>({ name: 'PaginationStore' }),
	) {
		const service = this.register(new PaginationService(store), {
			name: 'PaginationService',
		})
		this.declareDependency(service, store, { type: 'uses' })
		return service
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
		const service = this.register(
			new MappedList<TEntity, TId>(options, entityStore, listIdsStore),
			{ name: options.name },
		)
		this.declareDependency(service, entityStore, { type: 'uses' })
		this.declareDependency(service, listIdsStore, { type: 'uses' })
		return service
	}

	createSortingService<TField extends string>(
		options: SortingServiceOptions<TField>,
	) {
		const store = this.createStore<SortingState<TField>>({
			name: `${options.name ?? 'SortingService'}.Store`,
		})
		const service = this.register(new SortingService(store, options), {
			name: options.name ?? 'SortingService',
		})
		this.declareDependency(service, store, { type: 'uses' })
		return service
	}

	createFiltersService<TFilters extends Record<string, unknown>>(
		options: FiltersServiceOptions<TFilters>,
	) {
		const store = this.createStore<TFilters>({
			name: `${options.name ?? 'FiltersService'}.Store`,
		})
		const service = this.register(new FiltersService(store, options), {
			name: options.name ?? 'FiltersService',
		})
		this.declareDependency(service, store, { type: 'uses' })
		return service
	}

	register<T extends object>(instance: T, options: RegisterOptions = {}): T {
		const original = this.unwrap(instance)
		const name = options.name ?? this.inferName(original)
		const context = { runtime: this, instance: original, name }

		this.emit('beforeRegister', context)
		this.names.set(original, name)

		const wrapped = this.wrapObject(original)
		this.emit('afterRegister', context)

		return wrapped as T
	}

	declareDependency(
		from: DependencyTarget,
		to: DependencyTarget,
		options: DependencyDeclarationOptions = {},
	): void {
		this.emitCustomEvent('dependencyDeclared', {
			from: this.resolveDependencyLabel(from),
			to: this.resolveDependencyLabel(to),
			type: options.type ?? 'uses',
		})
	}

	dispose(): void {
		if (this.disposed) {
			return
		}

		this.disposed = true
		this.emit('runtimeDisposed', { runtime: this })
	}

	emitCustomEvent(name: string, payload?: unknown): void {
		this.emit('customEvent', { runtime: this, name, payload })
	}

	private readonly executeAsync = async <T>(
		label: string,
		callback: () => T | Promise<T>,
	): Promise<T> => {
		const context = { runtime: this, label }
		this.emit('beforeAsync', context)

		try {
			const result = await callback()
			this.emit('afterAsync', { ...context, result })
			return result
		} catch (error) {
			this.emitRuntimeError(error)
			this.emit('afterAsync', { ...context, result: undefined })
			throw error
		}
	}

	private wrapObject<T extends object>(instance: T): T {
		if (this.isProxy(instance)) {
			return instance
		}

		const existingProxy = this.proxies.get(instance)

		if (existingProxy !== undefined) {
			return existingProxy as T
		}

		const runtime = this
		const proxy = new Proxy(instance, {
			get(target, property, receiver) {
				if (property === PROXY_MARKER) {
					return target
				}

				const value = Reflect.get(target, property, receiver)

				if (typeof property !== 'string' || typeof value !== 'function') {
					return value
				}

				if (!isPrototypeMethod(target, property)) {
					return value
				}

				return (...args: unknown[]) =>
					runtime.callMethod(
						target,
						receiver,
						property,
						value as (...methodArgs: unknown[]) => unknown,
						args,
					)
			},
		})

		this.proxies.set(instance, proxy)
		return proxy
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

	private callMethod(
		target: object,
		receiver: unknown,
		method: string,
		fn: (...args: unknown[]) => unknown,
		args: readonly unknown[],
	): unknown {
		const context = this.createMethodContext(target, method, args)
		this.emit('beforeMethod', context)

		try {
			const result = Reflect.apply(fn, receiver, args)

			if (isPromiseLike(result)) {
				return result.then(
					(resolved) => {
						this.emit('afterMethod', { ...context, result: resolved })
						return resolved
					},
					(error) => {
						this.emit('methodError', { ...context, error })
						this.emitRuntimeError(error)
						throw error
					},
				)
			}

			this.emit('afterMethod', { ...context, result })
			return result
		} catch (error) {
			this.emit('methodError', { ...context, error })
			this.emitRuntimeError(error)
			throw error
		}
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
			runtime: this,
			store,
			method,
			key,
			normalizedKey,
			value,
		}

		this.emitStoreBefore(method, context)

		try {
			const result = Reflect.apply(fn, store, args)
			this.emitStoreAfter(method, { ...context, result })
			return result
		} catch (error) {
			this.emitRuntimeError(error)
			throw error
		}
	}

	private createMethodContext(
		target: object,
		method: string,
		args: readonly unknown[],
	): MethodEventContext {
		return {
			runtime: this,
			target,
			name: this.names.get(target) ?? this.inferName(target),
			method,
			args,
		}
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

	private emit(method: 'runtimeCreated', context: RuntimeEventContext): void
	private emit(method: 'runtimeDisposed', context: RuntimeEventContext): void
	private emit(
		method: 'beforeRegister',
		context: RegistrationEventContext,
	): void
	private emit(method: 'afterRegister', context: RegistrationEventContext): void
	private emit(method: 'beforeMethod', context: MethodEventContext): void
	private emit(method: 'afterMethod', context: MethodResultEventContext): void
	private emit(method: 'methodError', context: MethodErrorEventContext): void
	private emit(method: 'beforeStoreGet', context: StoreEventContext): void
	private emit(method: 'afterStoreGet', context: StoreEventContext): void
	private emit(method: 'beforeStoreSet', context: StoreEventContext): void
	private emit(method: 'afterStoreSet', context: StoreEventContext): void
	private emit(method: 'beforeStoreDelete', context: StoreEventContext): void
	private emit(method: 'afterStoreDelete', context: StoreEventContext): void
	private emit(method: 'beforeStoreClear', context: StoreEventContext): void
	private emit(method: 'afterStoreClear', context: StoreEventContext): void
	private emit(method: 'beforeAsync', context: AsyncEventContext): void
	private emit(method: 'afterAsync', context: AsyncResultEventContext): void
	private emit(method: 'runtimeError', context: RuntimeErrorEventContext): void
	private emit(method: 'customEvent', context: CustomEventContext): void
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
				if (method !== 'runtimeError') {
					this.emitRuntimeError(error)
				}
			}
		}
	}

	private emitRuntimeError(error: unknown): void {
		this.emit('runtimeError', { runtime: this, error })
	}

	private inferName(instance: object): string {
		return instance.constructor.name || 'AnonymousObject'
	}

	private resolveDependencyLabel(target: DependencyTarget): string {
		if (typeof target === 'string') {
			return target
		}

		const original = this.unwrap(target)
		return this.names.get(original) ?? this.inferName(original)
	}

	private unwrap<T extends object>(instance: T): T {
		if (this.isProxy(instance)) {
			return Reflect.get(instance, PROXY_MARKER) as T
		}

		return instance
	}

	private isProxy(instance: object): boolean {
		return Reflect.get(instance, PROXY_MARKER) !== undefined
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

function isPromiseLike(value: unknown): value is Promise<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'then' in value &&
		typeof value.then === 'function'
	)
}

function isPrototypeMethod(target: object, property: string): boolean {
	const prototype = Object.getPrototypeOf(target)

	if (prototype === null) {
		return false
	}

	const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
	return typeof descriptor?.value === 'function'
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
