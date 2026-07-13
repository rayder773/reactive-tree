import type { ReactivityApi } from '../../reactivity'
import { resolveContextualFn, type RepeatNode, type RepeatOptions } from './nodeTypes'

export function createRepeatNode<TItem>(
  reactivity: ReactivityApi,
  id: string,
  options: RepeatOptions<TItem>,
): RepeatNode<TItem> {
  return {
    id,
    type: 'repeat',
    items: resolveContextualFn(reactivity, options.items, undefined),
    isVisible: resolveContextualFn(reactivity, options.isVisible ?? true, undefined),
    getKey: options.key,
  }
}
