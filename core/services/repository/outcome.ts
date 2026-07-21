export type OutcomeDescriptor<T> =
  | { readonly type: 'success'; readonly data: T }
  | { readonly type: 'error'; readonly status: number; readonly body: unknown }
  | { readonly type: 'loading' }
  | { readonly type: 'network-error' }

export const success = <T>(data: T): OutcomeDescriptor<T> => ({ type: 'success', data })
export const error = (status: number, body: unknown): OutcomeDescriptor<never> => ({ type: 'error', status, body })
export const loading = (): OutcomeDescriptor<never> => ({ type: 'loading' })
export const networkError = (): OutcomeDescriptor<never> => ({ type: 'network-error' })
