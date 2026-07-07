import type { CheckMode } from '../types'
import { check } from './check'
import { error } from './diagnostics'

export function minLength(limit: number, options: { mode?: CheckMode } = {}) {
	return check<{ length: number }>(
		(value) =>
			value.length < limit
				? error('minLength', `Value length must be at least ${limit}`, {
						minLength: limit,
					})
				: undefined,
		{
			mode: options.mode ?? 'error',
			metadata: { kind: 'minLength', minLength: limit },
		},
	)
}

export function maxLength(limit: number, options: { mode?: CheckMode } = {}) {
	return check<{ length: number }>(
		(value) =>
			value.length > limit
				? error('maxLength', `Value length must be at most ${limit}`, {
						maxLength: limit,
					})
				: undefined,
		{
			mode: options.mode ?? 'error',
			metadata: { kind: 'maxLength', maxLength: limit },
		},
	)
}
