import { check } from './check'
import { error } from './diagnostics'
import type { CheckMode } from '../types'

type ValuesGetter<T> = (self: any) => readonly T[]

export function oneOf<T>(
  valuesOrGetter: readonly T[] | ValuesGetter<T>,
  options: { mode?: CheckMode } = {},
) {
  return check<T>(
    (value, context) => {
      if (value === null || value === undefined || value === '') {
        return undefined
      }

      const values =
        typeof valuesOrGetter === 'function'
          ? valuesOrGetter(context.root)
          : valuesOrGetter

      if (!values.includes(value)) {
        return error('oneOf', 'Value must be one of the allowed values', {
          allowed: values,
          value,
        })
      }

      return undefined
    },
    {
      mode: options.mode ?? 'error',
      metadata: { kind: 'oneOf', values: valuesOrGetter },
    },
  )
}
