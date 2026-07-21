import { createPartsDomain } from '../examples/apps/parts-list/parts-domain'

describe('parts domain', () => {
  it('loads repository data and creates independent manufacturer copies', async () => {
    const domain = createPartsDomain()
    try {
      await domain.ready
      expect(domain.allParts.items.get()).toHaveLength(6)
      expect(domain.northwindView.items.get().every((part) => part.manufacturer === 'Northwind')).toBe(true)

      const contoso = domain.createManufacturerView('Contoso')
      await contoso.query.replace()
      expect(contoso.items.get().every((part) => part.manufacturer === 'Contoso')).toBe(true)
      contoso.query.sorting.setDirection('desc')
      expect(domain.northwindView.query.sorting.state.get().direction).toBe('asc')

      const id = contoso.items.get()[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        domain.increasePrice(id)
        expect(domain.allParts.items.get().find((part) => part.id === id)).toBe(domain.entities.get(id))
      }
      expect(domain.deleteManufacturerView('Contoso')).toBe(true)
    } finally {
      domain.dispose()
    }
  })
})
