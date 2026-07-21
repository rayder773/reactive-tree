<script lang="ts">
  import type { ManufacturerView as ManufacturerViewModel, PartsDomain } from '../../../apps/parts-list/parts-domain'

  let { domain, view }: { domain: PartsDomain; view: ManufacturerViewModel } = $props()
  const items = view.items
  const filtering = view.filtering.state
  const sorting = view.sorting.state
</script>

<section class="panel">
  <div class="panel-heading">
    <div>
      <h2>{filtering.value.manufacturer} view</h2>
      <small>Price {sorting.value.direction}</small>
    </div>
    <button
      class="danger"
      type="button"
      onclick={() => domain.deleteManufacturerView(filtering.value.manufacturer)}
    >Remove view</button>
  </div>
  <table>
    <thead><tr><th>Part</th><th>Price</th><th>Stock</th></tr></thead>
    <tbody>
      {#each items.value as part (part.id)}
        <tr>
          <td>{part.name}</td><td>${part.price.toFixed(2)}</td><td>{part.stock}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
