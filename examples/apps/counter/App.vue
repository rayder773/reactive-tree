<script setup lang="ts">
import type { CounterController } from './domain'

const props = defineProps<{ controller: CounterController }>()
const count = props.controller.count
</script>

<template>
  <section class="counter-card">
    <div class="counter-value">{{ count.get() }}</div>
    <div class="counter-actions">
      <button type="button" @click="controller.decrement">−</button>
      <button type="button" @click="controller.reset">Reset</button>
      <button type="button" @click="controller.increment">+</button>
    </div>
  </section>
</template>

<style scoped>
.counter-card { max-width: 420px; padding: 40px; text-align: center; border-radius: 16px; background: white; box-shadow: 0 8px 30px #17203312; }
.counter-value { margin-bottom: 24px; font-size: 4rem; font-variant-numeric: tabular-nums; font-weight: 700; }
.counter-actions { display: flex; justify-content: center; gap: 10px; }
button { padding: 9px 16px; border: 1px solid #d0d5dd; border-radius: 8px; color: #344054; background: white; cursor: pointer; }
</style>
