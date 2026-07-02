import { computed as vueComputed } from 'vue'
import { childPath, diagnosticsRefs, registerDebugNode } from '../nodes/utils'
import type { ActionNode, AnyNode, BuildContext, NodeSpec } from '../types'

export type ButtonGetter<T, TRoot = any> = (root: TRoot) => T

export interface ButtonConfig<TRoot = any> {
  disabled?: ButtonGetter<boolean, TRoot>
  display?: ButtonGetter<boolean, TRoot>
  label?: string | (() => string)
  handlers?: Record<string, ActionNode>
}

export interface ButtonNode extends AnyNode {
  readonly kind: 'button'
  readonly disabled: { value: boolean }
  readonly display: { value: boolean }
  readonly label: string | undefined
  readonly labelReactive: boolean
  readonly domProp: 'textContent'
  readonly handlers: Record<string, ActionNode>
}

function buildComputedChild(
  context: BuildContext,
  key: string,
  getter: ButtonGetter<boolean> | undefined,
  fallback: boolean,
): { value: boolean } {
  if (getter) {
    const path = childPath(context.path, key)
    const ref = vueComputed(() =>
      context.debug.runWithReader(
        { readerId: path, reason: 'computed' },
        () => getter(context.self),
      ),
    )
    const node: any = { kind: 'computed', get value() { return ref.value } }
    context.debug.registerNode(node, { id: path, path, kind: 'computed', active: true })
    Object.assign(node, diagnosticsRefs(() => []))
    return node
  }

  const node: any = { kind: 'computed', get value() { return fallback } }
  Object.assign(node, diagnosticsRefs(() => []))
  return node
}

export function button<TRoot = any>(config: ButtonConfig<TRoot> = {}): NodeSpec<ButtonNode> {
  return {
    build(context: BuildContext): ButtonNode {
      const node: any = {
        kind: 'button' as const,
        domProp: 'textContent' as const,
        handlers: config.handlers ?? {},
      }

      if (typeof config.label === 'function') {
        const labelGetter = config.label
        const path = childPath(context.path, 'label')
        const labelRef = vueComputed(() =>
          context.debug.runWithReader(
            { readerId: path, reason: 'computed' },
            () => labelGetter(),
          ),
        )
        Object.defineProperty(node, 'label', { get() { return labelRef.value }, enumerable: true })
        node.labelReactive = true
      } else {
        node.label = config.label
        node.labelReactive = false
      }

      Object.defineProperty(node, '__displayDebug', { value: context.debug, enumerable: false })

      registerDebugNode(context, node, 'button')
      Object.assign(node, diagnosticsRefs(() => []))

      node.disabled = buildComputedChild(context, 'disabled', config.disabled as ButtonGetter<boolean>, false)
      node.display = buildComputedChild(context, 'display', config.display as ButtonGetter<boolean>, true)

      context.registerNode?.(node)

      return node as ButtonNode
    },
  }
}
