import type { Check, CheckMode, CheckResult } from '../types'

export interface CheckOptions {
  mode?: CheckMode
  metadata?: unknown
}

export function check<T>(
  fn: Check<T>['run'],
  options: CheckOptions = {},
): Check<T> {
  return {
    mode: options.mode ?? 'error',
    metadata: options.metadata,
    run: fn,
  }
}

export function normalizeCheckResult(result: ReturnType<Check['run']>): CheckResult {
  if (!result) {
    return {}
  }

  if (Array.isArray(result)) {
    return { diagnostic: result }
  }

  if ('level' in result) {
    return { diagnostic: result }
  }

  return result
}
