import type { CheckMode } from '../types'
import { check } from './check'
import { error } from './diagnostics'

type ValuesGetter<T> = (self: any) => readonly T[]

export function manyOf<T>(
	valuesOrGetter: readonly T[] | ValuesGetter<T>,
	options: { mode?: CheckMode } = {},
) {
	return check<readonly T[] | null | undefined>(
		(value, context) => {
			if (value === null || value === undefined) {
				return undefined
			}

			const values =
				typeof valuesOrGetter === 'function'
					? valuesOrGetter(context.root)
					: valuesOrGetter

			const invalid = value.filter((item) => !values.includes(item))

			if (invalid.length > 0) {
				return error('manyOf', 'Values must be from the allowed values', {
					allowed: values,
					invalid,
				})
			}

			return undefined
		},
		{
			mode: options.mode ?? 'error',
			metadata: { kind: 'manyOf', values: valuesOrGetter },
		},
	)
}
