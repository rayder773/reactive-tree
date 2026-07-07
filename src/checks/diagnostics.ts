import type { Diagnostic } from '../types'

export function error(
	code: string,
	message: string,
	payload?: unknown,
): Diagnostic {
	return payload === undefined
		? { level: 'error', code, message }
		: { level: 'error', code, message, payload }
}

export function warning(
	code: string,
	message: string,
	payload?: unknown,
): Diagnostic {
	return payload === undefined
		? { level: 'warning', code, message }
		: { level: 'warning', code, message, payload }
}
