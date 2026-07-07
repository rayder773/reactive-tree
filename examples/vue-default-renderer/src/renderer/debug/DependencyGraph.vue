<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AnyNode, DebugStore, DependencyReason } from '../../../../../src'
import DependencyGraphNodeDetails from './DependencyGraphNodeDetails.vue'
import DependencyGraphTable from './DependencyGraphTable.vue'
import { buildGraphLayout } from './graphLayout'

const props = defineProps<{
	tree: AnyNode & { debug: DebugStore }
}>()

const selectedReason = ref<DependencyReason | 'all'>('all')
const selectedNodeId = ref<string | null>(null)

function edgeKey(edge: {
	readerId: string
	targetId: string
	targetProp: string
	reason: string
}): string {
	return `${edge.readerId}\0${edge.targetId}\0${edge.targetProp}\0${edge.reason}`
}

const crossEdges = computed(() => props.tree.debug.crossEdges.value)
const visibleCrossEdges = computed(() =>
	crossEdges.value.filter((edge) => edge.targetProp !== 'diagnostics'),
)
const visibleInternalEdges = computed(() => {
	const crossEdgeKeys = new Set(visibleCrossEdges.value.map(edgeKey))

	return props.tree.debug.edges.value.filter(
		(edge) =>
			edge.targetProp !== 'diagnostics' && !crossEdgeKeys.has(edgeKey(edge)),
	)
})

const reasons = computed(() => {
	const allEdges = [...visibleInternalEdges.value, ...visibleCrossEdges.value]
	return Array.from(new Set(allEdges.map((edge) => edge.reason))).sort()
})
const nodes = computed(() => props.tree.debug.nodes.value)
const edges = computed(() => {
	const source = visibleInternalEdges.value

	return selectedReason.value === 'all'
		? source
		: source.filter((edge) => edge.reason === selectedReason.value)
})
const filteredCrossEdges = computed(() =>
	selectedReason.value === 'all'
		? visibleCrossEdges.value
		: visibleCrossEdges.value.filter(
				(edge) => edge.reason === selectedReason.value,
			),
)
const layout = computed(() =>
	buildGraphLayout(edges.value, filteredCrossEdges.value),
)
</script>

<template>
  <section class="dependency-graph">
    <div class="dependency-toolbar">
      <label>
        Reason
        <select v-model="selectedReason">
          <option value="all">All</option>
          <option v-for="reason in reasons" :key="reason" :value="reason">
            {{ reason }}
          </option>
        </select>
      </label>
    </div>

    <div class="dependency-grid">
      <div class="dependency-svg-panel">
        <svg
          class="dependency-svg"
          :viewBox="`0 0 ${layout.width} ${layout.height}`"
          role="img"
          aria-label="Dependency graph"
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="#777" />
            </marker>
            <marker
              id="arrow-cross"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="#d97706" />
            </marker>
          </defs>

          <line
            v-for="line in layout.lines"
            :key="`${line.edge.readerId}:${line.edge.targetId}:${line.edge.targetProp}:${line.edge.reason}`"
            :x1="line.from.x + 90"
            :y1="line.from.y"
            :x2="line.to.x - 100"
            :y2="line.to.y"
            :stroke="line.isCross ? '#d97706' : '#999'"
            :stroke-width="line.isCross ? 2 : 1.5"
            :stroke-dasharray="line.isCross ? '5,3' : undefined"
            :marker-end="line.isCross ? 'url(#arrow-cross)' : 'url(#arrow)'"
          />

          <g
            v-for="point in layout.readers"
            :key="`reader:${point.id}`"
            class="graph-node"
            :class="{ selected: selectedNodeId === point.id }"
            @click="selectedNodeId = point.id"
          >
            <rect :x="point.x - 110" :y="point.y - 14" width="210" height="28" rx="4" />
            <text :x="point.x - 100" :y="point.y + 5">{{ point.id }}</text>
          </g>

          <g
            v-for="point in layout.targets"
            :key="`target:${point.id}`"
            class="graph-node"
            :class="{ selected: selectedNodeId === point.id.split('.').slice(0, -1).join('.') }"
            @click="selectedNodeId = point.id.split('.').slice(0, -1).join('.')"
          >
            <rect :x="point.x - 120" :y="point.y - 14" width="260" height="28" rx="4" />
            <text :x="point.x - 110" :y="point.y + 5">{{ point.id }}</text>
          </g>
        </svg>
      </div>

      <DependencyGraphNodeDetails
        :tree="tree"
        :node-id="selectedNodeId"
        :nodes="nodes"
      />
    </div>

    <DependencyGraphTable :edges="edges" :crossEdges="filteredCrossEdges" />
  </section>
</template>
