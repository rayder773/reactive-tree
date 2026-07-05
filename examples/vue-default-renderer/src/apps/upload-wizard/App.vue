<template>
  <div>
    <div v-if="wizard.currentStep.value === 'upload'">
      <AppSelect :node="wizardDisplay.uploadForm.uploadType" />

      <hr />

      <AppSelect :node="wizardDisplay.uploadForm.approvedAction" />

      <hr />

      <AppFileInput :node="wizardDisplay.uploadForm.file" />

      <hr />

      <AppButton :node="wizardDisplay.submitButton" />
    </div>
    <div v-else-if="wizard.currentStep.value === 'mapping'">
      <AppTable :node="wizardDisplay.mappingTable">
        <template #cell-select-mpn>
          <AppSelect :node="wizardDisplay.mappingForm.mpn" />
        </template>
        <template #cell-select-manufacturer>
          <AppSelect :node="wizardDisplay.mappingForm.manufacturer" />
        </template>
        <template #cell-select-ipn>
          <AppSelect :node="wizardDisplay.mappingForm.ipn" />
        </template>
      </AppTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { wizardDisplay } from './display'
import { wizard } from './tree'
import AppSelect from '../../ui/AppSelect.vue'
import AppFileInput from '../../ui/AppFileInput.vue'
import AppButton from '../../ui/AppButton.vue'
import AppTable from '../../ui/AppTable.vue'
</script>
