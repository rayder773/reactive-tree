<template>
  <div>
    <div v-if="wizard.currentStep.value === 'upload'">
      <AppSelect
        :node="wizardDisplay.uploadForm.uploadType"
        :options="UPLOAD_TYPE_OPTIONS"
      />

      <hr />

      <AppSelect
        :node="wizardDisplay.uploadForm.approvedAction"
        :options="APPROVED_ACTION_OPTIONS"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { wizardDisplay } from './display'
import { wizard } from './tree'
import AppSelect from '../../ui/AppSelect.vue'

const UPLOAD_TYPE_OPTIONS = [
  { value: 'approvedVendorList', label: 'Approved vendor list' },
  { value: 'customPartData', label: 'Custom part data' },
]

const APPROVED_ACTION_OPTIONS = [
  { value: 'createNew', label: 'Create new' },
  { value: 'replaceExisting', label: 'Replace existing' },
]
</script>
