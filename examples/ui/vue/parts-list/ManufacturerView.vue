<script setup lang="ts">
import type { ManufacturerView, PartsDomain } from '../../../apps/parts-list/parts-domain'

const props = defineProps<{ domain: PartsDomain; view: ManufacturerView }>()
const items = props.view.items
const filtering = props.view.filtering.state
const sorting = props.view.sorting.state
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <h2>{{ filtering.value.manufacturer }} view</h2>
        <small>Price {{ sorting.value.direction }}</small>
      </div>
      <button class="danger" type="button" @click="domain.deleteManufacturerView(filtering.value.manufacturer)">Remove view</button>
    </div>
    <table>
      <thead><tr><th>Part</th><th>Price</th><th>Stock</th></tr></thead>
      <tbody>
        <tr v-for="part in items.value" :key="part.id">
          <td>{{ part.name }}</td><td>${{ part.price.toFixed(2) }}</td><td>{{ part.stock }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
