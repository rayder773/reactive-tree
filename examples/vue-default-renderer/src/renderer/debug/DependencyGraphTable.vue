<script setup lang="ts">
import type { DependencyEdge } from '../../../../../src'

defineProps<{
	edges: readonly DependencyEdge[]
	crossEdges?: readonly DependencyEdge[]
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
      <tr v-if="!edges.length && !crossEdges?.length">
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
      <template v-if="crossEdges?.length">
        <tr class="cross-section-header">
          <td colspan="4">Cross-tree edges (display → data)</td>
        </tr>
        <tr
          v-for="edge in crossEdges"
          :key="`cross:${edge.readerId}:${edge.targetId}:${edge.targetProp}:${edge.reason}`"
          class="cross-edge-row"
        >
          <td>{{ edge.readerId }}</td>
          <td>{{ edge.targetId }}</td>
          <td>{{ edge.targetProp }}</td>
          <td>{{ edge.reason }}</td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<style scoped>
.cross-section-header td {
  background: #fff7ed;
  color: #92400e;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-top: 2px solid #d97706;
}

.cross-edge-row {
  background: #fffbeb;
}

.cross-edge-row td {
  color: #78350f;
}
</style>
