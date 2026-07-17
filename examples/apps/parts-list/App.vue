<script setup lang="ts">
import type { PartsDomain } from './parts-domain'

const props = defineProps<{ domain: PartsDomain }>()
const entities = props.domain.entities.entities
const allParts = props.domain.allParts.items
const allSorting = props.domain.allParts.sorting!
const allPagination = props.domain.allParts.pagination!
const northwindParts = props.domain.northwindParts.items
const northwindSorting = props.domain.northwindParts.sorting!
const northwindFilters = props.domain.northwindParts.filters!
</script>

<template>
  <div class="parts-page">
    <div class="toolbar">
      <span>{{ entities.get().size }} normalized entities</span>
      <button type="button" @click="domain.addPart">Add Northwind part</button>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div><h2>All parts</h2><small>Sorted by {{ allSorting.get().field }} · {{ allSorting.get().direction }}</small></div>
        <div class="actions">
          <button type="button" @click="domain.toggleAllSort">Toggle sort</button>
          <button type="button" @click="domain.allParts.setPage(1)">Reset page</button>
          <button type="button" @click="domain.allParts.loadNextPage">Next page</button>
        </div>
      </div>
      <p class="page-label">Page {{ allPagination.get().page }} · {{ allPagination.get().total }} results</p>
      <table>
        <thead><tr><th>Part</th><th>Manufacturer</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="part in allParts.get()" :key="part.id">
            <td>{{ part.name }}</td><td>{{ part.manufacturer }}</td><td>${{ part.price.toFixed(2) }}</td><td>{{ part.stock }}</td>
            <td class="actions"><button type="button" @click="domain.increasePrice(part.id)">+$1</button><button class="danger" type="button" @click="domain.deletePart(part.id)">Delete</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><h2>Northwind view</h2><small>Price {{ northwindSorting.get().direction }} · filter {{ northwindFilters.get().manufacturer ?? 'off' }}</small></div>
        <button type="button" @click="domain.toggleNorthwindFilter">Toggle Northwind filter</button>
      </div>
      <table>
        <thead><tr><th>Part</th><th>Price</th><th>Stock</th></tr></thead>
        <tbody>
          <tr v-for="part in northwindParts.get()" :key="part.id">
            <td>{{ part.name }}</td><td>${{ part.price.toFixed(2) }}</td><td>{{ part.stock }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style src="./style.css" scoped></style>
