<script lang="ts">
import { defineComponent, inject, type PropType } from 'vue'
import type { ButtonNode } from '../../ui'
import { REPEAT_CTX_KEY } from './repeatContext'
import { useReactiveValue } from './useReactiveValue'

export default defineComponent({
  name: 'AppButton',
  props: {
    node: {
      type: Object as PropType<ButtonNode>,
      required: true,
    },
  },
  setup(props) {
    const ctx = inject(REPEAT_CTX_KEY, undefined)
    const resolved = props.node.resolve(ctx)
    const run = () => void Promise.resolve(resolved.onClick())
    return {
      disabled: useReactiveValue(resolved.disabled),
      isVisible: useReactiveValue(resolved.isVisible),
      run,
      text: useReactiveValue(resolved.text),
    }
  },
})
</script>

<template>
  <button
    v-if="isVisible"
    type="button"
    :disabled="disabled"
    @click="run"
  >
    {{ text }}
  </button>
</template>
