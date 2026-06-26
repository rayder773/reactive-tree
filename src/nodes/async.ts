import { ref, watchEffect } from 'vue'
import type { AsyncError, AsyncNode, AsyncNodeOptions, AsyncStatus, BuildContext, NodeSpec } from '../types'
import { diagnosticsRefs, registerDebugNode } from './utils'

const UNSET = Symbol('unset')

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

export function asyncNode<T, TInput = void>(options: AsyncNodeOptions<T, TInput> = {}): NodeSpec<AsyncNode<T, TInput>> {
  return {
    build(context: BuildContext): AsyncNode<T, TInput> {
      const valueRef = ref<T | null>(null)
      const statusRef = ref<AsyncStatus>('idle')
      const errorRef = ref<AsyncError | null>(null)

      let fetcher: ((input: TInput, signal: AbortSignal) => Promise<T>) | null = null
      let abortController: AbortController | null = null
      let lastInput: TInput | typeof UNSET = UNSET
      let frozen = false

      function reset() {
        abortController?.abort()
        abortController = null
        lastInput = UNSET
        valueRef.value = null
        statusRef.value = 'idle'
        errorRef.value = null
      }

      async function execute(input: TInput, isRevalidating: boolean) {
        if (!fetcher) return

        abortController?.abort()
        abortController = new AbortController()
        const { signal } = abortController

        statusRef.value = isRevalidating ? 'revalidating' : 'loading'
        errorRef.value = null

        try {
          const result = await fetcher(input, signal)
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

      if (options.trigger) {
        const { trigger } = options
        watchEffect(() => {
          const triggerValue = context.debug.runWithReader(
            { readerId: context.path, reason: 'async.trigger' },
            () => trigger(context.self),
          )

          if (frozen) {
            frozen = false
          }

          if (triggerValue != null) {
            lastInput = triggerValue as TInput
            execute(lastInput, false)
          } else {
            reset()
          }
        }, { flush: 'sync' })
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
        call(input: TInput) {
          frozen = true
          lastInput = input
          execute(input, false)
        },
        refetch() {
          if (lastInput !== UNSET) {
            const isRevalidating = statusRef.value === 'success' || statusRef.value === 'revalidating'
            execute(lastInput as TInput, isRevalidating)
          } else if (!options.trigger) {
            execute(undefined as unknown as TInput, false)
          }
        },
        __register(fn: (input: TInput, signal: AbortSignal) => Promise<T>) {
          fetcher = fn
          if (options.trigger) {
            const triggerValue = options.trigger(context.self)
            if (triggerValue != null && !frozen) {
              lastInput = triggerValue as TInput
              execute(lastInput, false)
            }
          }
        },
      } as unknown as AsyncNode<T, TInput>

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
