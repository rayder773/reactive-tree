import type { AppRuntimeOptions } from '../types/runtime'
import { AppRuntime } from './AppRuntime'

export function createAppRuntime(options: AppRuntimeOptions = {}): AppRuntime {
	return new AppRuntime(options)
}
