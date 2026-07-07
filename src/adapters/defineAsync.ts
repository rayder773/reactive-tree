import type { AsyncNode, NodeSpec } from '../types'
import type { SimScenario } from './sim'

export interface DefineAsyncConfig<T, TInput> {
	fetch?: (input: TInput, signal: AbortSignal) => Promise<T>
	scenarios?: Record<string, SimScenario<T>>
}

export function defineAsync<T, TInput>(
	spec: NodeSpec<AsyncNode<T, TInput>>,
	config: DefineAsyncConfig<T, TInput>,
	env: Record<string, string | undefined> = {},
): NodeSpec<AsyncNode<T, TInput>> {
	return {
		build(context) {
			const node = spec.build(context)

			const nodeKey = context.path.split('.').pop()!
			const nodeScenario = env[`VITE_SIM_${nodeKey}`]
			const globalSim = env['VITE_SIM']

			const useMock = nodeScenario !== undefined || globalSim === 'true'

			if (useMock && config.scenarios) {
				const key =
					nodeScenario && nodeScenario !== 'true'
						? nodeScenario
						: Object.keys(config.scenarios)[0]
				const scenario = config.scenarios[key]
				if (scenario) {
					node.__register((_input, signal) => scenario.execute(signal))
				}
			} else if (config.fetch) {
				node.__register(config.fetch)
			}

			return node
		},
	}
}
