import { effectScope } from 'vue'
import { createDebugStore } from './debug'
import { section } from './nodes/section'
import type { SectionChildren, TreeNode } from './types'

export function createTree<TChildren extends SectionChildren>(
  children: TChildren,
): TreeNode<TChildren> {
  const root = {}
  const debug = createDebugStore()
  const deferred: Array<() => void> = []
  let building = true
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
    defer: (fn: () => void) => {
      if (building) {
        deferred.push(fn)
      } else {
        fn()
      }
    },
  }

  const scope = effectScope(true)
  const tree = scope.run(() => {
    const builtTree = section(children).build(context)
    building = false
    for (const fn of deferred) {
      fn()
    }
    return builtTree
  }) as TreeNode<TChildren>

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
