<template>
  <div>
    <div v-if="wizard.currentStep.value === 'upload'">
      <AppSelect :node="wizardDisplay.uploadForm.uploadType" />

      <hr />

      <AppSelect :node="wizardDisplay.uploadForm.approvedAction" />

      <hr />

      <AppFileInput :node="wizardDisplay.uploadForm.file" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { wizardDisplay } from './display'
import { wizard } from './tree'
import AppSelect from '../../ui/AppSelect.vue'
import AppFileInput from '../../ui/AppFileInput.vue'
</script>
