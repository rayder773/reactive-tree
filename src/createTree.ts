import { effectScope } from 'vue'
import { createDebugStore } from './debug'
import { section } from './nodes/section'
import type { SectionChildren, TreeNode } from './types'

export function createTree<TChildren extends SectionChildren>(
  children: TChildren,
): TreeNode<TChildren> {
  const root = {}
  const debug = createDebugStore()
  debug.registerNode(root as any, {
    id: 'root',
    path: 'root',
    kind: 'section',
    active: true,
  })

  const context = {
    root,
    self: debug.createSelfProxy(root as any),
    path: 'root',
    debug,
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
    value: debug,
  })

  return tree
}
