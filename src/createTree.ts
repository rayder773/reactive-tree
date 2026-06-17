import { effectScope } from 'vue'
import { section } from './nodes/section'
import type { SectionChildren, TreeNode } from './types'

export function createTree<TChildren extends SectionChildren>(
  children: TChildren,
): TreeNode<TChildren> {
  const root = {}
  const context = {
    root,
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

  return tree
}
