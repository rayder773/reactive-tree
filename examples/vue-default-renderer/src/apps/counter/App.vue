<script setup lang="ts">
import { counter } from './tree'
</script>

<template>
  <div class="counter-app">
    <h2>Counter</h2>
    <p class="count-value">{{ counter.count.value }}</p>
    <div class="counter-buttons">
      <button @click="counter.count.set(counter.count.value - 1)">−</button>
      <button @click="counter.count.set(counter.count.value + 1)">+</button>
    </div>
  </div>
</template>

<style scoped>
.counter-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.count-value {
  font-size: 3rem;
  font-weight: bold;
  margin: 0;
}

.counter-buttons {
  display: flex;
  gap: 1rem;
}

.counter-buttons button {
  font-size: 1.5rem;
  width: 3rem;
  height: 3rem;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f5f5f5;
}

.counter-buttons button:hover {
  background: #e0e0e0;
}
</style>
