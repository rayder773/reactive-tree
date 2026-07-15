import type { RuntimePlugin } from './lifecycle'

export interface AppRuntimeOptions {
	plugins?: readonly RuntimePlugin[]
}

export interface CreateStoreOptions {
	name?: string
}
