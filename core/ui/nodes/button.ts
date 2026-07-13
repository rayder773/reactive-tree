import type { ReactivityApi } from '../../reactivity'
import {
  createResolveCache,
  resolveContextualFn,
  type ButtonNode,
  type ButtonOptions,
} from './nodeTypes'

export function createButtonNode(
  reactivity: ReactivityApi,
  id: string,
  options: ButtonOptions,
): ButtonNode {
  return {
    id,
    type: 'button',
    resolve: createResolveCache((ctx) => ({
      text: resolveContextualFn(reactivity, options.text, ctx),
      disabled: resolveContextualFn(reactivity, options.disabled ?? false, ctx),
      isVisible: resolveContextualFn(reactivity, options.isVisible ?? true, ctx),
      onClick: () => {
        const fn = options.onClick
        if (fn === undefined) return undefined
        if ((fn as (...args: unknown[]) => unknown).length > 0) {
          return (fn as (ctx: unknown) => void | Promise<void>)(ctx)
        }
        return (fn as () => void | Promise<void>)()
      },
    })),
  }
}
