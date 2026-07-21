import type { ManufacturerView as ManufacturerViewModel, PartsDomain } from '../../../apps/parts-list/parts-domain'

export function ManufacturerView({
  domain,
  view,
}: {
  domain: PartsDomain
  view: ManufacturerViewModel
}) {
  const items = view.items
  const filtering = view.query.filtering.state
  const sorting = view.query.sorting.state
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{filtering.value.manufacturer} view</h2>
          <small>Price {sorting.value.direction}</small>
        </div>
        {filtering.value.manufacturer !== 'Northwind' && (
          <button
            className="danger"
            type="button"
            onClick={() => domain.deleteManufacturerView(filtering.value.manufacturer)}
          >
            Remove view
          </button>
        )}
      </div>
      <table>
        <thead><tr><th>Part</th><th>Price</th><th>Stock</th></tr></thead>
        <tbody>
          {items.value.map((part) => (
            <tr key={part.id}>
              <td>{part.name}</td><td>${part.price.toFixed(2)}</td><td>{part.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
