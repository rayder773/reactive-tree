<script setup lang="ts">
import type { AnyNode } from '../../../../src'
import AsyncRenderer from './AsyncRenderer.vue'
import ComputedRenderer from './ComputedRenderer.vue'
import ListRenderer from './ListRenderer.vue'
import RecordRenderer from './RecordRenderer.vue'
import SectionRenderer from './SectionRenderer.vue'
import StateRenderer from './StateRenderer.vue'
import {
  isAsyncNode,
  isComputedNode,
  isListNode,
  isRecordNode,
  isSectionNode,
  isStateNode,
} from './rendererUtils'

defineProps<{
  node: AnyNode
  root: AnyNode
  label?: string
}>()
</script>

<template>
  <AsyncRenderer
    v-if="isAsyncNode(node)"
    :node="node"
    :label="label"
  />
  <StateRenderer
    v-else-if="isStateNode(node)"
    :node="node"
    :root="root"
    :label="label"
  />
  <ComputedRenderer
    v-else-if="isComputedNode(node)"
    :node="node"
    :label="label"
  />
  <ListRenderer
    v-else-if="isListNode(node)"
    :node="node"
    :root="root"
    :label="label"
  />
  <RecordRenderer
    v-else-if="isRecordNode(node)"
    :node="node"
    :root="root"
    :label="label"
  />
  <SectionRenderer
    v-else-if="isSectionNode(node)"
    :node="node"
    :root="root"
    :label="label"
  />
  <div v-else class="node unknown-node">
    Unknown node: {{ label }}
  </div>
</template>
