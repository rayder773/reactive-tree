import type { RuntimePlugin } from './lifecycle'

export interface AppRuntimeOptions {
	plugins?: readonly RuntimePlugin[]
}

export interface RegisterOptions {
	name?: string
}

export type AsyncExecutor = <T>(
	label: string,
	callback: () => T | Promise<T>,
) => Promise<T>
