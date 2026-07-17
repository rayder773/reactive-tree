import { createPartsDomain } from '../examples/apps/parts-list/parts-domain'

describe('parts domain', () => {
  it('keeps both views reactive while their state stays independent', () => {
    const domain = createPartsDomain()
    const before = domain.northwindParts.items.get().length
    domain.addPart()
    expect(domain.entities.values()).toHaveLength(7)
    expect(domain.northwindParts.items.get()).toHaveLength(before + 1)
    const id = domain.northwindParts.items.get()[0].id
    domain.increasePrice(id)
    const entity = domain.entities.get(id)
    expect(domain.allParts.items.get().find((part) => part.id === id)).toBe(entity)
    expect(domain.northwindParts.items.get().find((part) => part.id === id)).toBe(entity)
    domain.toggleNorthwindFilter()
    expect(domain.northwindParts.filters?.get().manufacturer).toBeNull()
    expect(domain.allParts.pagination?.get().pageSize).toBe(3)
    domain.deletePart(id)
    expect(domain.northwindParts.items.get().some((part) => part.id === id)).toBe(false)
    domain.dispose()
  })
})
