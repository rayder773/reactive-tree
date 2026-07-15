import { ApiError } from './api-error'
import type { OutcomeDescriptor } from './outcome'

type DropLast<T extends any[]> = T extends [...infer Head, AbortSignal]
	? Head
	: T extends [...infer Head, any]
		? Head
		: []

type ParamsWithoutSignal<F> = F extends (...args: infer A) => any
	? DropLast<A>
	: never

type MethodResult<F> = F extends (...args: any[]) => Promise<infer R>
	? R
	: never

type Handler<TRepo, K extends keyof TRepo> =
	| OutcomeDescriptor<MethodResult<TRepo[K]>>
	| ((...args: ParamsWithoutSignal<TRepo[K]>) => OutcomeDescriptor<MethodResult<TRepo[K]>>)

type Handlers<TRepo, TDefined extends keyof TRepo> = {
	[K in TDefined]: Handler<TRepo, K>
}

function delayMs(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = globalThis.setTimeout(resolve, ms)
		signal.addEventListener(
			'abort',
			() => {
				globalThis.clearTimeout(timeout)
				reject(new DOMException('Aborted', 'AbortError'))
			},
			{ once: true },
		)
	})
}

export class ScenarioBuilder<TRepo, TDefined extends keyof TRepo> {
	private readonly _handlers: Partial<Handlers<TRepo, keyof TRepo>> = {}
	private _delay = 0

	delay(ms: number): this {
		this._delay = ms
		return this
	}

	on<K extends Exclude<keyof TRepo, TDefined>>(
		method: K,
		handler: Handler<TRepo, K>,
	): ScenarioBuilder<TRepo, TDefined | K> {
		;(this._handlers as Record<keyof TRepo, Handler<TRepo, keyof TRepo>>)[method] =
			handler as Handler<TRepo, keyof TRepo>
		return this as unknown as ScenarioBuilder<TRepo, TDefined | K>
	}

	build(
		this: keyof TRepo extends TDefined ? ScenarioBuilder<TRepo, keyof TRepo> : never,
	): TRepo {
		const handlers = this._handlers as Handlers<TRepo, keyof TRepo>
		const delayMs_ = this._delay

		const repo = {} as TRepo

		for (const key of Object.keys(handlers) as Array<keyof TRepo>) {
			const handler = handlers[key]

			;(repo as Record<keyof TRepo, unknown>)[key] = async (
				...allArgs: unknown[]
			) => {
				const signal = allArgs[allArgs.length - 1] as AbortSignal
				const args = allArgs.slice(0, -1)

				const descriptor =
					typeof handler === 'function'
						? (handler as (...a: unknown[]) => OutcomeDescriptor<unknown>)(...args)
						: (handler as OutcomeDescriptor<unknown>)

				switch (descriptor.type) {
					case 'success':
						await delayMs(delayMs_, signal)
						return descriptor.data

					case 'error':
						await delayMs(delayMs_, signal)
						throw new ApiError(descriptor.status, descriptor.body)

					case 'loading':
						await new Promise<never>((_resolve, reject) => {
							signal.addEventListener(
								'abort',
								() => reject(new DOMException('Aborted', 'AbortError')),
								{ once: true },
							)
						})
						break

					case 'network-error':
						await delayMs(delayMs_, signal)
						throw new ApiError(0, null)
				}
			}
		}

		return repo
	}
}

export function createScenario<TRepo>(): ScenarioBuilder<TRepo, never> {
	return new ScenarioBuilder<TRepo, never>()
}
