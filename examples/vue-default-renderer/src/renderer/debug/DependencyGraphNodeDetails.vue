<script setup lang="ts">
import type { AnyNode, DebugNodeInfo, DebugStore } from '../../../../../src'

const props = defineProps<{
  tree: AnyNode & { debug: DebugStore }
  nodeId: string | null
  nodes: readonly DebugNodeInfo[]
}>()
</script>

<template>
  <aside class="dependency-details">
    <template v-if="props.nodeId">
      <h3>{{ props.nodeId }}</h3>
      <p>
        <strong>Kind:</strong>
        {{ props.nodes.find(node => node.id === props.nodeId)?.kind ?? 'unknown' }}
      </p>
      <p>
        <strong>Active:</strong>
        {{ props.nodes.find(node => node.id === props.nodeId)?.active ?? false }}
      </p>

      <h4>Reads</h4>
      <ul>
        <li v-for="item in tree.debug.readsOf(props.nodeId)" :key="item">{{ item }}</li>
      </ul>

      <h4>Read by</h4>
      <ul>
        <li v-for="item in tree.debug.readBy(props.nodeId)" :key="item">{{ item }}</li>
      </ul>
    </template>

    <p v-else>Select a graph node to inspect dependencies.</p>
  </aside>
</template>
