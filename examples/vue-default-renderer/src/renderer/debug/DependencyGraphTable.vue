<script setup lang="ts">
import type { DependencyEdge } from '../../../../../src'

defineProps<{
  edges: readonly DependencyEdge[]
}>()
</script>

<template>
  <table class="dependency-table">
    <thead>
      <tr>
        <th>Reader</th>
        <th>Reads</th>
        <th>Prop</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="!edges.length">
        <td colspan="4">No dependency edges yet. Interact with the tree or read computed values.</td>
      </tr>
      <tr
        v-for="edge in edges"
        :key="`${edge.readerId}:${edge.targetId}:${edge.targetProp}:${edge.reason}`"
      >
        <td>{{ edge.readerId }}</td>
        <td>{{ edge.targetId }}</td>
        <td>{{ edge.targetProp }}</td>
        <td>{{ edge.reason }}</td>
      </tr>
    </tbody>
  </table>
</template>
