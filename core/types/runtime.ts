import type { RuntimePlugin } from './lifecycle'

export interface AppRuntimeOptions {
	plugins?: readonly RuntimePlugin[]
}

export interface RegisterOptions {
	name?: string
	dependencies?: readonly DependencyTarget[]
}

export interface CreateStoreOptions {
	name?: string
}

export type DependencyTarget = object | string

export interface DependencyDeclarationOptions {
	type?: string
}

export type AsyncExecutor = <T>(
	label: string,
	callback: () => T | Promise<T>,
) => Promise<T>
