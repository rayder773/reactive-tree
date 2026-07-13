<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { RepeatNode } from '../../ui'
import AppRepeatItem from './AppRepeatItem.vue'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
  name: 'AppRepeat',
  components: { AppRepeatItem },
  props: {
    node: {
      type: Object as PropType<RepeatNode<unknown>>,
      required: true,
    },
  },
  setup(props) {
    return {
      items: useReactiveValue(props.node.items),
      isVisible: useReactiveValue(props.node.isVisible),
      getKey: (item: unknown) => props.node.getKey(item),
    }
  },
})
</script>

<template>
  <template v-if="isVisible">
    <AppRepeatItem
      v-for="item in items"
      :key="getKey(item)"
      :item="item"
    >
      <slot :item="item" />
    </AppRepeatItem>
  </template>
</template>
