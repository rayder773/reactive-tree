<script lang="ts">
import { defineComponent, inject, markRaw, h, type PropType, type Slots } from 'vue'
import type { AnyNode } from '../../../../src'
import AsyncRenderer from './AsyncRenderer.vue'
import ComputedRenderer from './ComputedRenderer.vue'
import FormRenderer from './FormRenderer.vue'
import InputRenderer from './InputRenderer.vue'
import ListRenderer from './ListRenderer.vue'
import RecordRenderer from './RecordRenderer.vue'
import GroupRenderer from './GroupRenderer.vue'
import StateRenderer from './StateRenderer.vue'
import {
  isAsyncNode,
  isComputedNode,
  isFormNode,
  isGroupNode,
  isInputNode,
  isListNode,
  isRecordNode,
  isStateNode,
} from './rendererUtils'

function renderDefault(node: AnyNode, root: AnyNode, label?: string) {
  if (isInputNode(node)) return h(InputRenderer, { node, root, label })
  if (isFormNode(node)) return h(FormRenderer, { node, root, label })
  if (isAsyncNode(node)) return h(AsyncRenderer, { node, label })
  if (isStateNode(node)) return h(StateRenderer, { node, root, label })
  if (isComputedNode(node)) return h(ComputedRenderer, { node, label })
  if (isListNode(node)) return h(ListRenderer, { node, root, label })
  if (isRecordNode(node)) return h(RecordRenderer, { node, root, label })
  if (isGroupNode(node)) return h(GroupRenderer, { node, root, label })
  return h('div', { class: 'node unknown-node' }, `Unknown node: ${label}`)
}

export default defineComponent({
  name: 'NodeRenderer',
  props: {
    node: { type: Object as PropType<AnyNode>, required: true },
    root: { type: Object as PropType<AnyNode>, required: true },
    label: { type: String },
  },
  setup(props) {
    const treeSlots = inject<Slots>('treeSlots', {})
    const getHide = inject<() => AnyNode[]>('treeHide', () => [])

    // Created once — stable reference for Vue diffing when used as <component :is="children" />
    const children = markRaw(() => renderDefault(props.node, props.root, props.label))

    return () => {
      const { node, root, label } = props

      if (getHide().includes(node)) return null

      const slotFn = node.id ? treeSlots[node.id] : undefined
      if (slotFn) {
        return slotFn({ node, children })
      }

      return renderDefault(node, root, label)
    }
  },
})
</script>
