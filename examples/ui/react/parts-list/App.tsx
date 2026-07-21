import type { PartsDomain } from '../../../apps/parts-list/parts-domain'
import { ManufacturerView } from './ManufacturerView'

export function App({ domain }: { domain: PartsDomain }) {
  const entities = domain.entities.entities
  const allParts = domain.allParts.items
  const allSorting = domain.allParts.query.sorting.state
  const allLoading = domain.allParts.query.loading.state
  const manufacturerKeys = domain.manufacturerViews.keys
  const manufacturerViews = domain.manufacturerViews.items
  return (
    <div className="parts-page">
      <div className="toolbar">
        <span>{entities.value.size} normalized entities</span>
        <span>{allLoading.value.status}</span>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>All parts</h2><small>Sorted by {allSorting.value.field} · {allSorting.value.direction}</small></div>
          <button type="button" onClick={domain.toggleAllSort}>Toggle sort</button>
        </div>
        <table>
          <thead><tr><th>Part</th><th>Manufacturer</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody>
            {allParts.value.map((part) => (
              <tr key={part.id}>
                <td>{part.name}</td><td>{part.manufacturer}</td><td>${part.price.toFixed(2)}</td><td>{part.stock}</td>
                <td className="actions">
                  <button type="button" onClick={() => domain.increasePrice(part.id)}>+$1</button>
                  <button className="danger" type="button" onClick={() => domain.deletePart(part.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="toolbar view-toolbar">
        <span>Manufacturer views</span>
        <div className="actions">
          {domain.manufacturers
            .filter((manufacturer) => manufacturer !== 'Northwind' && !manufacturerKeys.value.includes(manufacturer))
            .map((manufacturer) => (
              <button
                key={manufacturer}
                type="button"
                onClick={() => domain.createManufacturerView(manufacturer)}
              >
                Add {manufacturer}
              </button>
            ))}
        </div>
      </div>

      <ManufacturerView domain={domain} view={domain.northwindView} />
      {manufacturerViews.value.map((view) => (
        <ManufacturerView key={view.id} domain={domain} view={view} />
      ))}
    </div>
  )
}
