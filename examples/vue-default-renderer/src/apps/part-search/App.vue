<template>
  <div class="part-search">
    <AppInput :node="display.searchInput" />
    <AppButton :node="display.clearButton" />
    <AppSelect :node="display.sortByInput" />
    <AppButton :node="display.sortDirButton" />
    <AppList :node="display.resultsList" />
  </div>
</template>

<script setup lang="ts">
import AppButton from '../../ui/AppButton.vue'
import AppInput from '../../ui/AppInput.vue'
import AppList from '../../ui/AppList.vue'
import AppSelect from '../../ui/AppSelect.vue'
import { display } from './display'
</script>

<style scoped>
.part-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  max-width: 800px;
}
</style>
