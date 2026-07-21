<script lang="ts">
  import type { PartsDomain } from '../../../apps/parts-list/parts-domain'
  import ManufacturerView from './ManufacturerView.svelte'

  let { domain }: { domain: PartsDomain } = $props()
  const entities = domain.entities.entities
  const allParts = domain.allParts.items
  const allSorting = domain.allParts.sorting.state
  const manufacturerKeys = domain.manufacturerViews.keys
  const manufacturerViews = domain.manufacturerViews.items
</script>

<div class="parts-page">
  <div class="toolbar">
    <span>{entities.value.size} normalized entities</span>
    <button type="button" onclick={domain.addPart}>Add Northwind part</button>
  </div>

  <section class="panel">
    <div class="panel-heading">
      <div><h2>All parts</h2><small>Sorted by {allSorting.value.field} · {allSorting.value.direction}</small></div>
      <button type="button" onclick={domain.toggleAllSort}>Toggle sort</button>
    </div>
    <table>
      <thead><tr><th>Part</th><th>Manufacturer</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
      <tbody>
        {#each allParts.value as part (part.id)}
          <tr>
            <td>{part.name}</td><td>{part.manufacturer}</td><td>${part.price.toFixed(2)}</td><td>{part.stock}</td>
            <td class="actions">
              <button type="button" onclick={() => domain.increasePrice(part.id)}>+$1</button>
              <button class="danger" type="button" onclick={() => domain.deletePart(part.id)}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <div class="toolbar view-toolbar">
    <span>Manufacturer views</span>
    <div class="actions">
      {#each domain.manufacturers.filter((manufacturer) => !manufacturerKeys.value.includes(manufacturer)) as manufacturer (manufacturer)}
        <button type="button" onclick={() => domain.createManufacturerView(manufacturer)}>Add {manufacturer}</button>
      {/each}
    </div>
  </div>

  {#each manufacturerViews.value as view (view.id)}
    <ManufacturerView {domain} {view} />
  {/each}
</div>
