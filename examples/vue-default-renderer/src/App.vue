<script setup lang="ts">
import DependencyGraph from './renderer/debug/DependencyGraph.vue'
import JsonView from './renderer/JsonView.vue'
import TreeRenderer from './renderer/TreeRenderer.vue'
import { wizard } from './uploadWizard.real'
import { wizardDisplay } from './uploadWizard.real.display'
</script>

<template>
  <main class="app-shell">
    <h2>Data tree</h2>
    <TreeRenderer :tree="wizard">
      <template #[wizard.uploadType.id]="{ children }">
        <h2>Выберите тип загрузки</h2>
        <component :is="children" />
      </template>
    </TreeRenderer>

    <hr />

    <h2>Display tree</h2>
    <TreeRenderer :tree="(wizardDisplay as any)" />

    <hr />

    <h2>Data tree — dependency graph</h2>
    <DependencyGraph :tree="(wizard as any)" />

    <hr />

    <h2>Display tree — dependency graph (orange = cross-tree reads)</h2>
    <DependencyGraph :tree="(wizardDisplay as any)" />

    <hr />

    <h2>Data tree value</h2>
    <pre class="debug-block"><JsonView :value="wizard.value" :indent="1" /></pre>

    <h2>Data tree diagnostics</h2>
    <pre class="debug-block">{{ wizard.diagnostics.value }}</pre>
  </main>
</template>
