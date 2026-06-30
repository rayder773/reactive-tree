import { effectScope } from 'vue'
import { createDebugStore } from '../debug'
import { section } from '../nodes/section'
import type { SectionChildren, TreeNode } from '../types'

export function createDisplayTree<TData, TChildren extends SectionChildren>(
  dataTree: TData,
  factory: (data: TData) => TChildren,
): TreeNode<TChildren> {
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

  const children = factory(dataProxy as TData)

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
  const tree = scope.run(() => section(children).build(context)) as TreeNode<TChildren>

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

  return tree
}
