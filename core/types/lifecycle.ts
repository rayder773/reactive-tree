import type { StoreKey } from './store'

export interface RuntimeEventContext {
	runtime: AppRuntimeLifecycleTarget
}

export interface RegistrationEventContext extends RuntimeEventContext {
	instance: object
	name: string
}

export interface MethodEventContext extends RuntimeEventContext {
	target: object
	name: string
	method: string
	args: readonly unknown[]
}

export interface MethodResultEventContext extends MethodEventContext {
	result: unknown
}

export interface MethodErrorEventContext extends MethodEventContext {
	error: unknown
}

export interface StoreEventContext extends RuntimeEventContext {
	store: object
	method: 'get' | 'set' | 'delete' | 'has' | 'clear'
	key: StoreKey | undefined
	normalizedKey: string
	value?: unknown
	result?: unknown
}

export interface AsyncEventContext extends RuntimeEventContext {
	label: string
}

export interface AsyncResultEventContext extends AsyncEventContext {
	result: unknown
}

export interface RuntimeErrorEventContext extends RuntimeEventContext {
	error: unknown
}

export interface CustomEventContext extends RuntimeEventContext {
	name: string
	payload?: unknown
}

export interface AppRuntimeLifecycleTarget {
	emitCustomEvent(name: string, payload?: unknown): void
}

export interface RuntimePlugin {
	name: string
	runtimeCreated?(context: RuntimeEventContext): void
	runtimeDisposed?(context: RuntimeEventContext): void
	beforeRegister?(context: RegistrationEventContext): void
	afterRegister?(context: RegistrationEventContext): void
	beforeMethod?(context: MethodEventContext): void
	afterMethod?(context: MethodResultEventContext): void
	methodError?(context: MethodErrorEventContext): void
	beforeStoreGet?(context: StoreEventContext): void
	afterStoreGet?(context: StoreEventContext): void
	beforeStoreSet?(context: StoreEventContext): void
	afterStoreSet?(context: StoreEventContext): void
	beforeStoreDelete?(context: StoreEventContext): void
	afterStoreDelete?(context: StoreEventContext): void
	beforeStoreClear?(context: StoreEventContext): void
	afterStoreClear?(context: StoreEventContext): void
	beforeAsync?(context: AsyncEventContext): void
	afterAsync?(context: AsyncResultEventContext): void
	runtimeError?(context: RuntimeErrorEventContext): void
	customEvent?(context: CustomEventContext): void
}
