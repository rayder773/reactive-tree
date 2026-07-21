import { ApiError } from './api-error'
import type { OutcomeDescriptor } from './outcome'

type MethodKey<TRepository> = {
  [TKey in keyof TRepository]-?: TRepository[TKey] extends (...args: infer TArgs) => Promise<unknown>
    ? TArgs extends [...unknown[], AbortSignal] ? TKey : never
    : never
}[keyof TRepository]
type MethodArgs<TMethod> = TMethod extends (...args: infer TArgs) => Promise<unknown> ? TArgs : never
type DropSignal<TArgs extends readonly unknown[]> = TArgs extends readonly [...infer THead, AbortSignal] ? THead : never
type MethodResult<TMethod> = TMethod extends (...args: infer _TArgs) => Promise<infer TResult> ? TResult : never
type Handler<TRepository, TKey extends MethodKey<TRepository>> =
  | OutcomeDescriptor<MethodResult<TRepository[TKey]>>
  | ((...args: DropSignal<MethodArgs<TRepository[TKey]>>) => OutcomeDescriptor<MethodResult<TRepository[TKey]>>)
type HandlerMap<TRepository> = { [TKey in MethodKey<TRepository>]: Handler<TRepository, TKey> }

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timeout)
      reject(abortError())
    }, { once: true })
  })
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(abortError()), { once: true })
  })
}

export class ScenarioBuilder<TRepository extends object, TDefined extends MethodKey<TRepository> = never> {
  readonly #handlers: Partial<HandlerMap<TRepository>>
  readonly #delay: number

  constructor(handlers: Partial<HandlerMap<TRepository>> = {}, delay = 0) {
    this.#handlers = handlers
    this.#delay = delay
  }

  delay(ms: number): ScenarioBuilder<TRepository, TDefined> {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Scenario delay must be a non-negative number')
    return new ScenarioBuilder(this.#handlers, ms)
  }

  on<TKey extends Exclude<MethodKey<TRepository>, TDefined>>(
    method: TKey,
    handler: Handler<TRepository, TKey>,
  ): ScenarioBuilder<TRepository, TDefined | TKey> {
    return new ScenarioBuilder({ ...this.#handlers, [method]: handler }, this.#delay)
  }

  build(
    this: Exclude<MethodKey<TRepository>, TDefined> extends never
      ? ScenarioBuilder<TRepository, TDefined>
      : never,
  ): TRepository {
    const repository: Partial<Record<MethodKey<TRepository>, unknown>> = {}

    for (const method of Reflect.ownKeys(this.#handlers) as Array<MethodKey<TRepository>>) {
      const handler = this.#handlers[method]
      if (!handler) continue
      repository[method] = async (...allArgs: unknown[]) => {
        const signal = allArgs.at(-1)
        if (!(signal instanceof AbortSignal)) throw new TypeError(`Scenario method "${String(method)}" requires AbortSignal last`)
        const args = allArgs.slice(0, -1)
        const descriptor = typeof handler === 'function'
          ? (handler as unknown as (...values: unknown[]) => OutcomeDescriptor<unknown>)(...args)
          : handler as OutcomeDescriptor<unknown>

        if (descriptor.type === 'loading') return waitForAbort(signal)
        await wait(this.#delay, signal)
        if (descriptor.type === 'success') return descriptor.data
        if (descriptor.type === 'network-error') throw new ApiError(0, null)
        throw new ApiError(descriptor.status, descriptor.body)
      }
    }

    return repository as unknown as TRepository
  }
}

export const createScenario = <TRepository extends object>(): ScenarioBuilder<TRepository> => (
  new ScenarioBuilder<TRepository>()
)
