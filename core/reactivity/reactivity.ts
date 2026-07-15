import type { RuntimePlugin, StoreEventContext } from '../types/lifecycle'
import type {
	Accessor,
	ReactiveComputed,
	ReactiveRef,
	ReactiveSource,
	ReactiveSubscription,
	ReactivityApi,
} from './reactivity.types'

type DependencyKey = string
type Subscriber = () => void

interface TrackedComputation {
	track(dependencyKey: DependencyKey): void
	trackSource(source: ReactiveSource<unknown>): void
}

export interface Reactivity extends RuntimePlugin, ReactivityApi {
	dispose(): void
}

export function createReactivity(): Reactivity {
	const subscribersByDependency = new Map<
		DependencyKey,
		Set<ReactiveComputation>
	>()
	const computations = new Set<ReactiveComputation>()
	const stack: TrackedComputation[] = []

	const trackStoreRead = (context: StoreEventContext): void => {
		const active = stack.at(-1)

		if (active === undefined) {
			return
		}

		active.track(getDependencyKey(context.store, context.normalizedKey))
	}

	const notifyStoreChange = (context: StoreEventContext): void => {
		if (context.method === 'clear') {
			for (const [dependencyKey, subscribers] of subscribersByDependency) {
				if (!dependencyKey.startsWith(getStorePrefix(context.store))) {
					continue
				}

				for (const subscriber of subscribers) {
					subscriber.invalidate()
				}
			}
			return
		}

		const subscribers = subscribersByDependency.get(
			getDependencyKey(context.store, context.normalizedKey),
		)

		if (subscribers === undefined) {
			return
		}

		for (const subscriber of subscribers) {
			subscriber.invalidate()
		}
	}

	const subscribeToDependency = (
		dependencyKey: DependencyKey,
		computation: ReactiveComputation,
	): void => {
		const subscribers =
			subscribersByDependency.get(dependencyKey) ??
			new Set<ReactiveComputation>()
		subscribers.add(computation)
		subscribersByDependency.set(dependencyKey, subscribers)
	}

	const unsubscribeFromDependency = (
		dependencyKey: DependencyKey,
		computation: ReactiveComputation,
	): void => {
		const subscribers = subscribersByDependency.get(dependencyKey)

		if (subscribers === undefined) {
			return
		}

		subscribers.delete(computation)

		if (subscribers.size === 0) {
			subscribersByDependency.delete(dependencyKey)
		}
	}

	const api: Reactivity = {
		name: 'Reactivity',
		afterStoreGet(context) {
			if (context.method === 'get' || context.method === 'has') {
				trackStoreRead(context)
			}
		},
		afterStoreSet: notifyStoreChange,
		afterStoreDelete: notifyStoreChange,
		afterStoreClear: notifyStoreChange,
		ref<T>(value: T): ReactiveRef<T> {
			return new ReactiveValue(value, () => stack.at(-1))
		},
		computed<T>(callback: Accessor<T>): ReactiveComputed<T> {
			const computation = new ReactiveComputation(
				callback,
				stack,
				subscribeToDependency,
				unsubscribeFromDependency,
				() => computations.delete(computation),
			)
			computations.add(computation)
			return computation
		},
		reactive<T extends object>(value: T): T {
			return createReactiveObject(value, api)
		},
		toComputed<T>(
			value: T | Accessor<T> | ReactiveSource<T>,
		): ReactiveComputed<T> {
			if (api.isReactiveSource<T>(value)) {
				return api.computed(() => value.get())
			}

			if (typeof value === 'function') {
				return api.computed(value as Accessor<T>)
			}

			return api.computed(() => value)
		},
		isReactiveSource<T>(value: unknown): value is ReactiveSource<T> {
			return (
				typeof value === 'object' &&
				value !== null &&
				'get' in value &&
				typeof value.get === 'function' &&
				'subscribe' in value &&
				typeof value.subscribe === 'function'
			)
		},
		dispose(): void {
			for (const computation of computations) {
				computation.dispose()
			}

			computations.clear()
			subscribersByDependency.clear()
		},
	}

	return api
}

class ReactiveValue<T> implements ReactiveRef<T> {
	private readonly subscribers = new Set<Subscriber>()

	constructor(
		private value: T,
		private readonly getActiveComputation: () => TrackedComputation | undefined,
	) {}

	get(): T {
		this.getActiveComputation()?.trackSource(this)
		return this.value
	}

	set(value: T): void {
		if (Object.is(this.value, value)) {
			return
		}

		this.value = value
		this.notify()
	}

	update(callback: (value: T) => T): void {
		this.set(callback(this.value))
	}

	subscribe(callback: Subscriber): ReactiveSubscription {
		this.subscribers.add(callback)
		return {
			dispose: () => {
				this.subscribers.delete(callback)
			},
		}
	}

	private notify(): void {
		for (const subscriber of this.subscribers) {
			subscriber()
		}
	}
}

class ReactiveComputation<T = unknown>
	implements ReactiveComputed<T>, TrackedComputation
{
	private readonly dependencies = new Set<DependencyKey>()
	private readonly nextDependencies = new Set<DependencyKey>()
	private readonly sources = new Set<ReactiveSource<unknown>>()
	private readonly nextSources = new Set<ReactiveSource<unknown>>()
	private readonly sourceSubscriptions = new Map<
		ReactiveSource<unknown>,
		ReactiveSubscription
	>()
	private readonly subscribers = new Set<Subscriber>()
	private value: T | undefined
	private evaluated = false
	private disposed = false
	private isDirty = true

	constructor(
		private readonly callback: Accessor<T>,
		private readonly stack: TrackedComputation[],
		private readonly subscribeToDependency: (
			dependencyKey: DependencyKey,
			computation: ReactiveComputation,
		) => void,
		private readonly unsubscribeFromDependency: (
			dependencyKey: DependencyKey,
			computation: ReactiveComputation,
		) => void,
		private readonly onDispose: () => void,
	) {}

	get dirty(): boolean {
		return this.isDirty
	}

	get(): T {
		const activeComputation = this.stack.at(-1)

		if (activeComputation !== undefined && activeComputation !== this) {
			activeComputation.trackSource(this)
		}

		if (!this.evaluated || this.isDirty) {
			this.evaluate()
		}

		return this.value as T
	}

	track(dependencyKey: DependencyKey): void {
		this.nextDependencies.add(dependencyKey)
	}

	trackSource(source: ReactiveSource<unknown>): void {
		this.nextSources.add(source)
	}

	invalidate(): void {
		if (this.disposed || this.isDirty) {
			return
		}

		this.isDirty = true

		for (const subscriber of this.subscribers) {
			subscriber()
		}
	}

	subscribe(callback: Subscriber): ReactiveSubscription {
		this.subscribers.add(callback)
		return {
			dispose: () => {
				this.subscribers.delete(callback)
			},
		}
	}

	dispose(): void {
		if (this.disposed) {
			return
		}

		this.disposed = true
		this.onDispose()

		for (const dependency of this.dependencies) {
			this.unsubscribeFromDependency(dependency, this)
		}

		for (const subscription of this.sourceSubscriptions.values()) {
			subscription.dispose()
		}

		this.dependencies.clear()
		this.nextDependencies.clear()
		this.sources.clear()
		this.nextSources.clear()
		this.sourceSubscriptions.clear()
		this.subscribers.clear()
	}

	private evaluate(): void {
		this.nextDependencies.clear()
		this.nextSources.clear()
		this.stack.push(this)

		try {
			this.value = this.callback()
			this.evaluated = true
			this.isDirty = false
			this.syncDependencies()
			this.syncSources()
		} finally {
			this.stack.pop()
		}
	}

	private syncDependencies(): void {
		for (const dependency of this.dependencies) {
			if (!this.nextDependencies.has(dependency)) {
				this.unsubscribeFromDependency(dependency, this)
			}
		}

		for (const dependency of this.nextDependencies) {
			if (!this.dependencies.has(dependency)) {
				this.subscribeToDependency(dependency, this)
			}
		}

		this.dependencies.clear()

		for (const dependency of this.nextDependencies) {
			this.dependencies.add(dependency)
		}
	}

	private syncSources(): void {
		for (const source of this.sources) {
			if (this.nextSources.has(source)) {
				continue
			}

			this.sourceSubscriptions.get(source)?.dispose()
			this.sourceSubscriptions.delete(source)
		}

		for (const source of this.nextSources) {
			if (this.sources.has(source)) {
				continue
			}

			this.sourceSubscriptions.set(
				source,
				source.subscribe(() => this.invalidate()),
			)
		}

		this.sources.clear()

		for (const source of this.nextSources) {
			this.sources.add(source)
		}
	}
}

function createReactiveObject<T extends object>(
	value: T,
	api: ReactivityApi,
): T {
	const refs = new Map<PropertyKey, ReactiveRef<unknown>>()

	return new Proxy(value, {
		get(target, property, receiver) {
			const existing = refs.get(property)

			if (existing !== undefined) {
				return existing.get()
			}

			return Reflect.get(target, property, receiver)
		},
		set(target, property, nextValue, receiver) {
			let ref = refs.get(property)

			if (ref === undefined) {
				ref = api.ref(Reflect.get(target, property, receiver))
				refs.set(property, ref)
			}

			ref.set(nextValue)
			return Reflect.set(target, property, nextValue, receiver)
		},
	})
}

function getDependencyKey(store: object, normalizedKey: string): DependencyKey {
	return `${getStorePrefix(store)}${normalizedKey}`
}

function getStorePrefix(store: object): string {
	return `${getObjectId(store)}:`
}

const objectIds = new WeakMap<object, number>()
let nextObjectId = 1

function getObjectId(value: object): number {
	const existingId = objectIds.get(value)

	if (existingId !== undefined) {
		return existingId
	}

	const id = nextObjectId
	nextObjectId += 1
	objectIds.set(value, id)
	return id
}
