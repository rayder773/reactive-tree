<script setup lang="ts">
import type { Diagnostic } from '../../../../src'
import { diagnosticsByLevel } from './rendererUtils'

const props = defineProps<{
  diagnostics: readonly Diagnostic[]
}>()
</script>

<template>
  <div v-if="props.diagnostics.length" class="diagnostics">
    <ul v-if="diagnosticsByLevel(props.diagnostics, 'error').length" class="diagnostic-list errors">
      <li v-for="diagnostic in diagnosticsByLevel(props.diagnostics, 'error')" :key="diagnostic.code + diagnostic.message">
        <strong>{{ diagnostic.code }}</strong>: {{ diagnostic.message }}
      </li>
    </ul>

    <ul v-if="diagnosticsByLevel(props.diagnostics, 'warning').length" class="diagnostic-list warnings">
      <li v-for="diagnostic in diagnosticsByLevel(props.diagnostics, 'warning')" :key="diagnostic.code + diagnostic.message">
        <strong>{{ diagnostic.code }}</strong>: {{ diagnostic.message }}
      </li>
    </ul>

    <ul v-if="diagnosticsByLevel(props.diagnostics, 'info').length" class="diagnostic-list info">
      <li v-for="diagnostic in diagnosticsByLevel(props.diagnostics, 'info')" :key="diagnostic.code + diagnostic.message">
        <strong>{{ diagnostic.code }}</strong>: {{ diagnostic.message }}
      </li>
    </ul>
  </div>
</template>
