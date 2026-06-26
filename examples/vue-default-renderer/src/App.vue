<script setup lang="ts">
import DependencyGraph from './renderer/debug/DependencyGraph.vue'
import JsonView from './renderer/JsonView.vue'
import TreeRenderer from './renderer/TreeRenderer.vue'
import { wizard } from './uploadWizard.real'
</script>

<template>
  <main class="app-shell">
    <h1>Vue Default Tree Renderer</h1>

    <div class="toolbar">
      <button type="button" @click="wizard.currentStep.set('upload')">Upload</button>
      <button type="button" @click="wizard.currentStep.set('mapping')">Mapping</button>
      <button type="button" @click="wizard.currentStep.set('result')">Result</button>
    </div>

    <TreeRenderer :tree="wizard" />

    <hr />

    <h2>Dependency graph</h2>
    <DependencyGraph :tree="wizard" />

    <hr />

    <h2>Tree value</h2>
    <pre class="debug-block"><JsonView :value="wizard.value" :indent="1" /></pre>

    <h2>Diagnostics</h2>
    <pre class="debug-block">{{ wizard.diagnostics.value }}</pre>
  </main>
</template>
