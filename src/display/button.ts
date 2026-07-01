import { computed as vueComputed } from 'vue'
import { childPath, diagnosticsRefs, registerDebugNode } from '../nodes/utils'
import type { AnyNode, BuildContext, NodeSpec } from '../types'

export type ButtonGetter<T, TRoot = any> = (root: TRoot) => T

export interface ButtonConfig<TRoot = any> {
  disabled?: ButtonGetter<boolean, TRoot>
  display?: ButtonGetter<boolean, TRoot>
  label?: string
}

export interface ButtonNode extends AnyNode {
  readonly kind: 'button'
  readonly disabled: { value: boolean }
  readonly display: { value: boolean }
  readonly label: string | undefined
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
        () => getter(context.root),
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
        label: config.label,
      }

      registerDebugNode(context, node, 'button')
      Object.assign(node, diagnosticsRefs(() => []))

      node.disabled = buildComputedChild(context, 'disabled', config.disabled as ButtonGetter<boolean>, false)
      node.display = buildComputedChild(context, 'display', config.display as ButtonGetter<boolean>, true)

      context.registerNode?.(node)

      return node as ButtonNode
    },
  }
}
