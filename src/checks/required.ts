import { check } from './check'
import { error } from './diagnostics'
import type { CheckMode } from '../types'

export function required(options: { mode?: CheckMode } = {}) {
  return check<unknown>(
    value => {
      const empty =
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)

      return empty ? error('required', 'Value is required') : undefined
    },
    { mode: options.mode ?? 'error', metadata: { kind: 'required' } },
  )
}
