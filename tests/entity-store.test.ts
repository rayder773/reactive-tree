import { data, entityStore, identity, readonlyData, type EntityStorePlugin } from '../core'

interface Row { id: number; name: string; group: string; score: number }
const row = (id: number, group = 'a'): Row => ({ id, name: `row-${id}`, group, score: id })

describe('EntityStore', () => {
  it('implements CRUD with new map references and full entity replacement', () => {
    const store = entityStore<Row>().use(identity((item) => item.id)).build()
    const initial = store.entities.get()
    const first = { ...row(1), extra: 'not retained by later values' }
    store.upsert(first)
    expect(store.entities.get()).not.toBe(initial)
    const afterFirst = store.entities.get()
    const replacement = row(1)
    store.upsert(replacement)
    expect(store.entities.get()).not.toBe(afterFirst)
    expect(store.get(1)).toBe(replacement)
    expect(store.get(1)).not.toHaveProperty('extra')
    expect(store.has(1)).toBe(true)
    expect(store.values()).toEqual([replacement])
    expect(store.delete(1)).toBe(true)
    expect(store.delete(1)).toBe(false)
    store.upsert(row(2))
    store.clear()
    expect(store.values()).toEqual([])
  })

  it('batch upserts and rejects id changes during update', () => {
    const store = entityStore<Row>().use(identity((item) => item.id)).build()
    const values = [row(1), row(2)]
    expect(store.upsertMany(values)).toBe(values)
    expect(store.update(3, (item) => item)).toBeUndefined()
    expect(() => store.update(1, (item) => ({ ...item, id: 3 }))).toThrow('cannot change its id')
    const updated = store.update(1, (item) => ({ ...item, name: 'updated' }))
    expect(store.get(1)).toBe(updated)
  })

  it('installs custom facade APIs and disposes lifecycle hooks once', () => {
    let disposeCount = 0
    const statusPlugin: EntityStorePlugin<Row, number, { status: ReturnType<typeof readonlyData<string>> }> = {
      install(context) {
        const status = data('ready')
        context.onDispose(() => { disposeCount++ })
        return { status: readonlyData(status) }
      },
    }
    const store = entityStore<Row>()
      .use(identity((item) => item.id))
      .use(statusPlugin)
      .build()
    expect(store.status.get()).toBe('ready')
    store.dispose()
    store.dispose()
    expect(disposeCount).toBe(1)
    expect(() => store.upsert(row(1))).toThrow('disposed')
  })

  it('does not accept more plugins after a builder is built', () => {
    const builder = entityStore<Row>().use(identity((item) => item.id))
    builder.build()
    expect(() => (builder as any).use({ install: () => ({ feature: true }) })).toThrow('after build')
  })

  it('rejects duplicate plugin API keys at runtime for untyped consumers', () => {
    const duplicate = { install: () => ({ values: 'duplicate' }) }
    const builder = entityStore<Row>().use(identity((item) => item.id))
    expect(() => (builder as any).use(duplicate).build()).toThrow('already exists')
  })
})
