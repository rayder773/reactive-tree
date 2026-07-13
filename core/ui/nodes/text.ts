import type { ReactivityApi } from '../../reactivity'
import {
  createResolveCache,
  resolveContextualFn,
  type TextNode,
  type TextOptions,
} from './nodeTypes'

export function createTextNode(
  reactivity: ReactivityApi,
  id: string,
  options: TextOptions,
): TextNode {
  return {
    id,
    type: 'text',
    resolve: createResolveCache((ctx) => ({
      value: resolveContextualFn(reactivity, options.value, ctx),
      isVisible: resolveContextualFn(reactivity, options.isVisible ?? true, ctx),
    })),
  }
}
