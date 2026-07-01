<template>
  <div>
    <div v-if="wizard.currentStep.value === 'upload'">
      <select v-model="wizard.uploadType.value">
        <option value="approvedVendorList">Approved vendor list</option>
        <option value="customPartData">Custom part data</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { wizardDisplay } from './display';
import { wizard } from './tree';
</script>
