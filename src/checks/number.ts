import type { CheckMode } from '../types'
import { check } from './check'
import { error } from './diagnostics'

export function min(limit: number, options: { mode?: CheckMode } = {}) {
	return check<number>(
		(value) =>
			value < limit
				? error('min', `Value must be at least ${limit}`, { min: limit })
				: undefined,
		{ mode: options.mode ?? 'error', metadata: { kind: 'min', min: limit } },
	)
}

export function max(limit: number, options: { mode?: CheckMode } = {}) {
	return check<number>(
		(value) =>
			value > limit
				? error('max', `Value must be at most ${limit}`, { max: limit })
				: undefined,
		{ mode: options.mode ?? 'error', metadata: { kind: 'max', max: limit } },
	)
}
