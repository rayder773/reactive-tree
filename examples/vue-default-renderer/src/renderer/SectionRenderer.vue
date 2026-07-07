<!-- Replaced by GroupRenderer.vue -->
<script setup lang="ts">
import type { AnyNode } from '../../../../src'
import type { SectionNode } from '../../../../src/types'
import GroupRenderer from './GroupRenderer.vue'

defineProps<{ node: SectionNode<any>; root: AnyNode; label?: string }>()
</script>
<template><GroupRenderer :node="node" :root="root" :label="label" /></template>
