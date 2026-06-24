import { ref } from 'vue'
import type { AsyncError, AsyncNode, AsyncStatus, BuildContext, NodeOptions, NodeSpec } from '../types'
import { diagnosticsRefs, registerDebugNode } from './utils'

function parseError(err: unknown): AsyncError {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return {
      message: typeof e.message === 'string' ? e.message : String(err),
      status: typeof e.status === 'number' ? e.status : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
      payload: e.payload,
    }
  }
  return { message: String(err) }
}

export function asyncNode<T>(options: NodeOptions = {}): NodeSpec<AsyncNode<T>> {
  return {
    build(context: BuildContext): AsyncNode<T> {
      const valueRef = ref<T | null>(null)
      const statusRef = ref<AsyncStatus>('idle')
      const errorRef = ref<AsyncError | null>(null)

      let fetcher: ((signal: AbortSignal) => Promise<T>) | null = null
      let abortController: AbortController | null = null

      async function execute(isRevalidating: boolean) {
        if (!fetcher) return

        abortController?.abort()
        abortController = new AbortController()
        const { signal } = abortController

        statusRef.value = isRevalidating ? 'revalidating' : 'loading'
        errorRef.value = null

        try {
          const result = await fetcher(signal)
          if (!signal.aborted) {
            valueRef.value = result
            statusRef.value = 'success'
          }
        } catch (err) {
          if (!signal.aborted) {
            statusRef.value = 'error'
            errorRef.value = parseError(err)
          }
        }
      }

      const node = {
        kind: 'async' as const,
        label: options.label,
        metadata: options.metadata,
        checks: [],
        get value() {
          return valueRef.value
        },
        get status() {
          return statusRef.value
        },
        get error() {
          return errorRef.value
        },
        refetch() {
          const isRevalidating = statusRef.value === 'success' || statusRef.value === 'revalidating'
          execute(isRevalidating)
        },
        __register(fn: (signal: AbortSignal) => Promise<T>) {
          fetcher = fn
        },
      } as unknown as AsyncNode<T>

      registerDebugNode(context, node, 'async')

      Object.assign(
        node,
        diagnosticsRefs(() => {
          if (statusRef.value === 'error' && errorRef.value) {
            return [{
              level: 'error' as const,
              code: 'async.error',
              message: errorRef.value.message,
              payload: errorRef.value,
            }]
          }
          return []
        }),
      )

      context.registerNode?.(node)

      return node
    },
  }
}
