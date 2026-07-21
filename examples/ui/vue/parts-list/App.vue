<script setup lang="ts">
import type { PartsDomain } from '../../../apps/parts-list/parts-domain'
import ManufacturerView from './ManufacturerView.vue'

const props = defineProps<{ domain: PartsDomain }>()
const entities = props.domain.entities.entities
const allParts = props.domain.allParts.items
const allSorting = props.domain.allParts.query.sorting.state
const allLoading = props.domain.allParts.query.loading.state
const manufacturerKeys = props.domain.manufacturerViews.keys
const manufacturerViews = props.domain.manufacturerViews.items
</script>

<template>
  <div class="parts-page">
    <div class="toolbar">
      <span>{{ entities.value.size }} normalized entities</span>
      <span>{{ allLoading.value.status }}</span>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div><h2>All parts</h2><small>Sorted by {{ allSorting.value.field }} · {{ allSorting.value.direction }}</small></div>
        <button type="button" @click="domain.toggleAllSort">Toggle sort</button>
      </div>
      <table>
        <thead><tr><th>Part</th><th>Manufacturer</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="part in allParts.value" :key="part.id">
            <td>{{ part.name }}</td><td>{{ part.manufacturer }}</td><td>${{ part.price.toFixed(2) }}</td><td>{{ part.stock }}</td>
            <td class="actions"><button type="button" @click="domain.increasePrice(part.id)">+$1</button><button class="danger" type="button" @click="domain.deletePart(part.id)">Delete</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="toolbar view-toolbar">
      <span>Manufacturer views</span>
      <div class="actions">
        <button
          v-for="manufacturer in domain.manufacturers.filter((name) => name !== 'Northwind' && !manufacturerKeys.value.includes(name))"
          :key="manufacturer"
          type="button"
          @click="domain.createManufacturerView(manufacturer)"
        >Add {{ manufacturer }}</button>
      </div>
    </div>

    <ManufacturerView :domain="domain" :view="domain.northwindView" />

    <ManufacturerView
      v-for="view in manufacturerViews.value"
      :key="view.id"
      :domain="domain"
      :view="view"
    />
  </div>
</template>
