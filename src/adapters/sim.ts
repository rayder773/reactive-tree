import type { AsyncNode } from '../types'

export interface SimScenario<T> {
  execute(signal: AbortSignal): Promise<T>
}

export function success<T>(data: T, options: { delay?: number } = {}): SimScenario<T> {
  return {
    execute(signal) {
      return new Promise<T>((resolve, reject) => {
        const delay = options.delay ?? 0
        const timer = setTimeout(() => resolve(data), delay)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    },
  }
}

export function error(
  message: string,
  options: { delay?: number; status?: number; code?: string } = {},
): SimScenario<never> {
  return {
    execute(signal) {
      return new Promise<never>((resolve, reject) => {
        const delay = options.delay ?? 0
        const timer = setTimeout(() => {
          const err = Object.assign(new Error(message), {
            status: options.status,
            code: options.code,
          })
          reject(err)
        }, delay)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    },
  }
}

export function loading(): SimScenario<never> {
  return {
    execute(signal) {
      return new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    },
  }
}

export interface SimBinding<T> {
  node: AsyncNode<T>
  activeScenario?: string
  scenarios: Record<string, SimScenario<T>>
}

export function createSimAdapter<T>(
  _tree: unknown,
  bindings: SimBinding<T>[],
  globalScenario?: string,
): void {
  for (const { node, activeScenario, scenarios } of bindings) {
    const keys = Object.keys(scenarios)
    const key = [activeScenario, globalScenario].find(s => s && scenarios[s]) ?? keys[0]
    const scenario = scenarios[key]

    if (!scenario) continue

    node.__register(signal => scenario.execute(signal))
    node.refetch()
  }
}
