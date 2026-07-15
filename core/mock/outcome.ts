export type OutcomeDescriptor<T> =
	| { type: 'success'; data: T }
	| { type: 'error'; status: number; body: unknown }
	| { type: 'loading' }
	| { type: 'network-error' }

export function success<T>(data: T): OutcomeDescriptor<T> {
	return { type: 'success', data }
}

export function error(status: number, body: unknown): OutcomeDescriptor<never> {
	return { type: 'error', status, body }
}

export function loading(): OutcomeDescriptor<never> {
	return { type: 'loading' }
}

export function networkError(): OutcomeDescriptor<never> {
	return { type: 'network-error' }
}
