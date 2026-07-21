<script setup lang="ts">
import type { CounterController } from '../../../apps/counter/domain'

const props = defineProps<{ controller: CounterController }>()
const count = props.controller.count
</script>

<template>
  <section class="counter-card">
    <div class="counter-value">{{ count.value }}</div>
    <div class="counter-actions">
      <button type="button" @click="controller.decrement">−</button>
      <button type="button" @click="controller.reset">Reset</button>
      <button type="button" @click="controller.increment">+</button>
    </div>
  </section>
</template>
