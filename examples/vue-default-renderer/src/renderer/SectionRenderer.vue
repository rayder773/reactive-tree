<!-- Replaced by GroupRenderer.vue -->
<script setup lang="ts">
import GroupRenderer from './GroupRenderer.vue'
import type { AnyNode } from '../../../../src'
import type { SectionNode } from '../../../../src/types'
defineProps<{ node: SectionNode<any>; root: AnyNode; label?: string }>()
</script>
<template><GroupRenderer :node="node" :root="root" :label="label" /></template>
