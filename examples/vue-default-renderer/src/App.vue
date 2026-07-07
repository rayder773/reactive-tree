<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DevPanel from './DevPanel.vue'
import { apps } from './registry'
import { InspectOverlay } from './ui/inspect'

const savedId = localStorage.getItem('selectedAppId')
const savedTab = localStorage.getItem('activeTab')

const selectedId = ref(
	apps.find((a) => a.id === savedId) ? savedId! : apps[0].id,
)
const activeTab = ref<'dev' | 'app'>(savedTab === 'app' ? 'app' : 'dev')

watch(selectedId, (v) => localStorage.setItem('selectedAppId', v))
watch(activeTab, (v) => localStorage.setItem('activeTab', v))

const selectedApp = computed(() => apps.find((a) => a.id === selectedId.value)!)
</script>

<template>
  <main class="app-shell">
    <nav class="app-switcher">
      <button
        v-for="app in apps"
        :key="app.id"
        :class="['app-btn', { active: selectedId === app.id }]"
        @click="selectedId = app.id; activeTab = 'dev'"
      >
        {{ app.label }}
      </button>
    </nav>

    <nav class="tab-switcher">
      <button
        :class="['tab-btn', { active: activeTab === 'dev' }]"
        @click="activeTab = 'dev'"
      >
        Dev
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'app' }]"
        @click="activeTab = 'app'"
      >
        App
      </button>
    </nav>

    <div class="tab-content">
      <DevPanel
        v-if="activeTab === 'dev'"
        :tree="selectedApp.tree"
        :display="selectedApp.display"
      />
      <component
        :is="selectedApp.component"
        v-else
      />
    </div>
  </main>
  <InspectOverlay />
</template>

<style scoped>
.app-switcher,
.tab-switcher {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
}

.app-switcher {
  background: #f8f8f8;
}

.tab-switcher {
  background: #fff;
}

.app-btn,
.tab-btn {
  padding: 0.4rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: #fff;
  font-size: 0.9rem;
}

.app-btn:hover,
.tab-btn:hover {
  background: #e8e8e8;
}

.app-btn.active,
.tab-btn.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

.tab-content {
  padding: 1rem;
}
</style>
