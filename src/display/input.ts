import { computed as vueComputed } from 'vue'
import { state } from '../nodes/state'
import { childPath, diagnosticsRefs, nodeDiagnostics, registerDebugNode } from '../nodes/utils'
import type { AnyNode, BuildContext, NodeSpec } from '../types'

export type InputGetter<T> = (self: InputNode) => T

export type SourceSpec = { value: unknown; set(v: unknown): void } | InputGetter<{ value: unknown; set(v: unknown): void } | undefined>

export interface InputConfig {
  source?: SourceSpec
  showError?: InputGetter<boolean>
  errorMessage?: InputGetter<string | undefined>
  disabled?: InputGetter<boolean>
  dirty?: InputGetter<boolean>
  [key: string]: InputGetter<unknown> | SourceSpec | undefined
}

export interface InputNode extends AnyNode {
  readonly kind: 'input'
  readonly source: { value: unknown; set(v: unknown): void } | undefined
  readonly dataRoot: any
  readonly touched: { value: boolean; set(v: boolean): boolean }
  readonly focused: { value: boolean; set(v: boolean): boolean }
  readonly showError: { value: boolean }
  readonly errorMessage: { value: string | undefined }
  readonly disabled: { value: boolean }
  readonly dirty: { value: boolean }
  [key: string]: any
}

function buildInputChild(
  context: BuildContext,
  key: string,
  getter: InputGetter<unknown> | undefined,
  inputNodeRef: { current: any },
): any {
  if (getter) {
    const path = childPath(context.path, key)
    const valueRef = vueComputed(() =>
      context.debug.runWithReader(
        { readerId: path, reason: 'computed' },
        () => getter(context.debug.createSelfProxy(inputNodeRef.current)),
      ),
    )
    const node: any = {
      kind: 'computed',
      get value() {
        return valueRef.value
      },
    }
    context.debug.registerNode(node, { id: path, path, kind: 'computed', active: true })
    Object.assign(node, diagnosticsRefs(() => []))
    return node
  }
  else {
    return state(undefined as any).build({
      ...context,
      path: childPath(context.path, key),
      registerNode: undefined,
    })
  }
}

export function input(config: InputConfig = {}): NodeSpec<InputNode> {
  return {
    build(context: BuildContext): InputNode {
      const touched = state(false).build({
        ...context,
        path: childPath(context.path, 'touched'),
        registerNode: undefined,
      })

      const focused = state(false).build({
        ...context,
        path: childPath(context.path, 'focused'),
        registerNode: undefined,
      })

      const node: any = {
        kind: 'input' as const,
        touched,
        focused,
        dataRoot: context.data,
      }

      registerDebugNode(context, node, 'input')
      Object.assign(node, diagnosticsRefs(() => nodeDiagnostics(node.source)))

      const inputNodeRef = { current: node }

      Object.defineProperty(node, 'source', {
        enumerable: false,
        configurable: true,
        get() {
          if (!config.source) return undefined
          if (typeof config.source === 'function') {
            return (config.source as InputGetter<any>)(inputNodeRef.current)
          }
          return config.source
        },
      })

      const initialSourceValue = node.source?.value

      const effectiveConfig: InputConfig = {
        ...config,
        dirty: config.dirty ?? (config.source !== undefined
          ? (_self: InputNode) => _self.source?.value !== initialSourceValue
          : undefined
        ),
      }

      const defaultKeys = ['showError', 'errorMessage', 'disabled', 'dirty']
      const configKeys = Object.keys(config).filter(k => !defaultKeys.includes(k) && k !== 'source')

      for (const key of [...defaultKeys, ...configKeys]) {
        node[key] = buildInputChild(context, key, effectiveConfig[key] as InputGetter<unknown> | undefined, inputNodeRef)
      }

      inputNodeRef.current = node

      context.registerNode?.(node)

      return node as InputNode
    },
  }
}
