import { createPartsDomain } from '../examples/apps/parts-list/parts-domain'

describe('parts domain', () => {
  it('keeps dynamic manufacturer views reactive with independent state', () => {
    const domain = createPartsDomain()
    const northwind = domain.manufacturerViews.get('Northwind')!
    expect(domain.manufacturerViews.keys.get()).toEqual(['Northwind'])
    expect(northwind.items.get().every((part) => part.manufacturer === 'Northwind')).toBe(true)

    const contoso = domain.createManufacturerView('Contoso')
    expect(domain.manufacturerViews.keys.get()).toEqual(['Northwind', 'Contoso'])
    contoso.sorting.setDirection('desc')
    expect(northwind.sorting.state.get().direction).toBe('asc')

    const before = northwind.items.get().length
    domain.addPart()
    expect(domain.entities.values()).toHaveLength(7)
    expect(northwind.items.get()).toHaveLength(before + 1)
    expect(contoso.items.get()).toHaveLength(2)

    const id = northwind.items.get()[0].id
    domain.increasePrice(id)
    const entity = domain.entities.get(id)
    expect(domain.allParts.items.get().find((part) => part.id === id)).toBe(entity)
    expect(northwind.items.get().find((part) => part.id === id)).toBe(entity)
    domain.deletePart(id)
    expect(northwind.items.get().some((part) => part.id === id)).toBe(false)

    expect(domain.deleteManufacturerView('Contoso')).toBe(true)
    expect(domain.manufacturerViews.keys.get()).toEqual(['Northwind'])
    domain.dispose()
  })
})
