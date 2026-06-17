<script setup lang="ts">
import TreeRenderer from './renderer/TreeRenderer.vue'
import { wizard } from './uploadWizard.tree'
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

    <h2>Tree value</h2>
    <pre class="debug-block">{{ wizard.value }}</pre>

    <h2>Diagnostics</h2>
    <pre class="debug-block">{{ wizard.diagnostics.value }}</pre>
  </main>
</template>
