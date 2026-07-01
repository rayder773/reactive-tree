<script setup lang="ts">
import DependencyGraph from './renderer/debug/DependencyGraph.vue'
import JsonView from './renderer/JsonView.vue'
import TreeRenderer from './renderer/TreeRenderer.vue'

const props = defineProps<{
  tree: any
  display?: any
}>()
</script>

<template>
  <div class="dev-panel">
    <h2>Data tree</h2>
    <TreeRenderer :tree="props.tree" />

    <template v-if="props.display">
      <hr />
      <h2>Display tree</h2>
      <TreeRenderer :tree="props.display" />
    </template>

    <hr />

    <h2>Data tree — dependency graph</h2>
    <DependencyGraph :tree="props.tree" />

    <template v-if="props.display">
      <hr />
      <h2>Display tree — dependency graph (orange = cross-tree reads)</h2>
      <DependencyGraph :tree="props.display" />
    </template>

    <hr />

    <h2>Data tree value</h2>
    <pre class="debug-block"><JsonView :value="props.tree.value" :indent="1" /></pre>

    <h2>Data tree diagnostics</h2>
    <pre class="debug-block">{{ props.tree.diagnostics.value }}</pre>
  </div>
</template>
