import { effectScope } from 'vue'
import { createDebugStore } from '../debug'
import { section } from '../nodes/section'
import type { SectionChildren, TreeNode } from '../types'

export type DisplayTreeOptions<TPlugins extends Record<string, object>> = {
  plugins?: TPlugins
}

export type DisplayTree<TChildren extends SectionChildren, TPlugins extends Record<string, object>> =
  TreeNode<TChildren> & { plugins: TPlugins }

export function createDisplayTree<
  TData,
  TChildren extends SectionChildren,
  TPlugins extends Record<string, object> = Record<never, never>,
>(
  dataTree: TData,
  factory: (plugins: TPlugins) => TChildren,
  options?: DisplayTreeOptions<TPlugins>,
): DisplayTree<TChildren, TPlugins> {
  const plugins = (options?.plugins ?? {}) as TPlugins

  const displayDebug = createDebugStore()
  const root = {}

  displayDebug.registerNode(root as any, {
    id: 'root',
    path: 'root',
    kind: 'section',
    active: true,
  })

  // Wrap dataTree in a proxy that tracks reads into the display debug store.
  // Since data tree node IDs are not registered in displayDebug, these reads
  // will appear in displayDebug.crossEdges automatically.
  const dataProxy = displayDebug.createSelfProxy(dataTree as any)

  const children = factory(plugins)

  const context = {
    root,
    self: displayDebug.createSelfProxy(root as any),
    data: dataProxy,
    path: 'root',
    debug: displayDebug,
    registerNode: (node: any) => {
      Object.setPrototypeOf(root, node)
    },
  }

  const scope = effectScope(true)
  const tree = scope.run(() => section(children).build(context)) as DisplayTree<TChildren, TPlugins>

  Object.defineProperty(tree, 'dispose', {
    enumerable: false,
    configurable: false,
    value: () => scope.stop(),
  })

  Object.defineProperty(tree, 'debug', {
    enumerable: false,
    configurable: false,
    value: displayDebug,
  })

  Object.defineProperty(tree, 'plugins', {
    enumerable: false,
    configurable: false,
    value: plugins,
  })

  return tree
}
