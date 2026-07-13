<script lang="ts">
import { defineComponent, provide } from 'vue'
import { REPEAT_CTX_KEY } from './repeatContext'

export default defineComponent({
  name: 'AppRepeatItem',
  props: {
    item: {
      required: true,
    },
  },
  setup(props) {
    provide(REPEAT_CTX_KEY, props.item)
  },
})
</script>

<template>
  <slot />
</template>
