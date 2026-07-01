<template>
  <div>
    <div v-if="wizard.currentStep.value === 'upload'">
      <AppSelect :node="wizardDisplay.uploadForm.uploadType" />

      <hr />

      <AppSelect :node="wizardDisplay.uploadForm.approvedAction" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { wizardDisplay } from './display'
import { wizard } from './tree'
import AppSelect from '../../ui/AppSelect.vue'
</script>
