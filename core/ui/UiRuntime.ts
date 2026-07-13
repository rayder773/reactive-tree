import type { ReactivityApi } from '../reactivity'
import { createButtonNode } from './nodes/button'
import type {
  ButtonNode,
  ButtonOptions,
  RepeatNode,
  RepeatOptions,
  TableNode,
  TableOptions,
  TextNode,
  TextOptions,
} from './nodes/nodeTypes'
import { createRepeatNode } from './nodes/repeat'
import { createTableNode } from './nodes/table'
import { createTextNode } from './nodes/text'
import { createReactiveList, type ReactiveList } from './reactive-list'

export interface UiRuntime {
  text<TCtx = unknown>(id: string, options: TextOptions<TCtx>): TextNode
  text(id: string): TextNode
  button<TCtx = unknown>(id: string, options: ButtonOptions<TCtx>): ButtonNode
  button(id: string): ButtonNode
  table<TRow, TCtx = unknown>(id: string, options: TableOptions<TRow, TCtx>): TableNode<TRow>
  table<TRow>(id: string): TableNode<TRow>
  repeat<TItem>(id: string, options: RepeatOptions<TItem>): RepeatNode<TItem>
  repeat<TItem>(id: string): RepeatNode<TItem>
  createList<T>(): ReactiveList<T>
}

export function createUiRuntime(reactivity: ReactivityApi): UiRuntime {
  const texts = new Map<string, TextNode>()
  const buttons = new Map<string, ButtonNode>()
  const tables = new Map<string, TableNode<unknown>>()
  const repeats = new Map<string, RepeatNode<unknown>>()

  function getOrThrow<T>(map: Map<string, T>, type: string, id: string): T {
    const node = map.get(id)
    if (node === undefined) {
      throw new Error(`UiRuntime: ${type} node "${id}" not found`)
    }
    return node
  }

  return {
    text<TCtx = unknown>(id: string, options?: TextOptions<TCtx>): TextNode {
      if (options !== undefined) {
        const node = createTextNode(reactivity, id, options as TextOptions)
        texts.set(id, node)
        return node
      }
      return getOrThrow(texts, 'text', id)
    },

    button<TCtx = unknown>(id: string, options?: ButtonOptions<TCtx>): ButtonNode {
      if (options !== undefined) {
        const node = createButtonNode(reactivity, id, options as ButtonOptions)
        buttons.set(id, node)
        return node
      }
      return getOrThrow(buttons, 'button', id)
    },

    table<TRow, TCtx = unknown>(id: string, options?: TableOptions<TRow, TCtx>): TableNode<TRow> {
      if (options !== undefined) {
        const node = createTableNode(reactivity, id, options as TableOptions<TRow>)
        tables.set(id, node as TableNode<unknown>)
        return node
      }
      return getOrThrow(tables, 'table', id) as TableNode<TRow>
    },

    repeat<TItem>(id: string, options?: RepeatOptions<TItem>): RepeatNode<TItem> {
      if (options !== undefined) {
        const node = createRepeatNode(reactivity, id, options)
        repeats.set(id, node as RepeatNode<unknown>)
        return node
      }
      return getOrThrow(repeats, 'repeat', id) as RepeatNode<TItem>
    },

    createList<T>(): ReactiveList<T> {
      return createReactiveList<T>(reactivity)
    },
  }
}
