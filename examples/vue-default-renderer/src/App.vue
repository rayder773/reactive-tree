<script setup lang="ts">
import DependencyGraph from './renderer/debug/DependencyGraph.vue'
import JsonView from './renderer/JsonView.vue'
import TreeRenderer from './renderer/TreeRenderer.vue'
import { wizard } from './uploadWizard.real'
</script>

<template>
  <main class="app-shell">
    <TreeRenderer :tree="wizard">
      <template #[wizard.uploadType.id]="{ children }">
        <h2>Выберите тип загрузки</h2>
        <component :is="children" />
      </template>

      <template #[wizard.test.id]="{ children }">
        <h2>Тестовая секция 11</h2>
        <component :is="children" />
      </template>

       <template #[wizard.test.innerSection.id]="{ children }">
        <h2>Внутренняя секция</h2>
        <component :is="children" />
      </template>

      <template #[wizard.test.innerSection.innerState.id]="{ children }">
        <h2>Внутренняя секция - внутреннее состояние</h2>
        <component :is="children" />
      </template>
      
    </TreeRenderer>

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
