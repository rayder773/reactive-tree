import {
  allEntities,
  data,
  entityLists,
  entityStore,
  filtering,
  identity,
  readonlyData,
  selection,
  sorting,
  type EntityListPlugin,
  type EntityListsPlugin,
} from '../core'

interface Row { id: number; name: string; group: string; score: number }
type Field = 'name' | 'score'
interface Filters { group: string | null }
const row = (id: number, group = 'a'): Row => ({ id, name: `row-${id}`, group, score: id })
const compare = (left: Row, right: Row, field: Field) => field === 'name'
  ? left.name.localeCompare(right.name)
  : left.score - right.score

const setup = () => {
  const store = entityStore<Row>().use(identity((item) => item.id)).build()
  const lists = entityLists(store).build()
  return { store, lists }
}

describe('entity lists', () => {
  it('keeps all-entity lists reactive with shared entity references', () => {
    const { store, lists } = setup()
    const list = lists.create('all').use(allEntities()).build()
    store.upsertMany([row(1), row(2)])
    expect(list.ids.get()).toEqual([1, 2])
    const replacement = { ...row(1), name: 'replacement' }
    store.upsert(replacement)
    expect(list.items.get()[0]).toBe(replacement)
    expect(list.items.get()[0]).toBe(store.get(1))
  })

  it('isolates filtering and sorting state for every list', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2, 'b'), row(3)])
    const create = (name: string) => lists.create(name)
      .use(allEntities())
      .use(sorting({ initial: { field: 'score' as const, direction: 'desc' as const }, compare }))
      .use(filtering<Row, Filters>({ initial: { group: 'a' }, predicate: (item, filters) => !filters.group || item.group === filters.group }))
      .build()
    const first = create('first')
    const second = create('second')
    expect(first.ids.get()).toEqual([3, 1])
    first.filtering.patch({ group: null })
    first.sorting.setDirection('asc')
    expect(first.ids.get()).toEqual([1, 2, 3])
    expect(second.ids.get()).toEqual([3, 1])
    expect(second.filtering.state.get()).toEqual({ group: 'a' })
  })

  it('uses fixed phases regardless of installation order and preserves order within a phase', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2), row(3)])
    const keepTwo: EntityListPlugin<Row, number, { cutoff: { state: ReturnType<typeof readonlyData<number>> } }> = {
      membership: false,
      install(context) {
        const state = data(2)
        context.watch(state)
        context.addTransform('filtering', (items) => items.filter((item) => item.id <= state.get()))
        return { cutoff: { state: readonlyData(state) } }
      },
    }
    const reverseFinal: EntityListPlugin<Row, number, Record<never, never>> = {
      membership: false,
      install(context) {
        context.addTransform('final', (items) => [...items].reverse())
        return {}
      },
    }
    const list = lists.create('pipeline')
      .use(reverseFinal)
      .use(sorting({ initial: { field: 'score' as const, direction: 'desc' as const }, compare }))
      .use(keepTwo)
      .use(allEntities())
      .build()
    expect(list.ids.get()).toEqual([1, 2])
  })

  it('supports selection entity and id commands, order, deduplication, and unknown ids', () => {
    const { store, lists } = setup()
    const list = lists.create('selected').use(selection()).build()
    list.selection.replace([row(1), row(2), row(1)])
    expect(list.ids.get()).toEqual([1, 2])
    const replacement = { ...row(2), name: 'new two' }
    list.selection.prepend([replacement, row(3)])
    expect(list.ids.get()).toEqual([3, 1, 2])
    expect(store.get(2)).toBe(replacement)
    list.selection.appendIds([4, 3, 4])
    expect(list.ids.get()).toEqual([3, 1, 2])
    store.upsert(row(4))
    expect(list.ids.get()).toEqual([3, 1, 2, 4])
    list.selection.prependIds([5, 1])
    store.upsert(row(5))
    expect(list.ids.get()).toEqual([5, 3, 1, 2, 4])
  })

  it('updates only members and synchronizes selection after store delete and clear', () => {
    const { store, lists } = setup()
    const list = lists.create('selected').use(selection()).build()
    list.selection.replaceIds([1, 2, 9])
    store.upsertMany([row(1), row(2), row(3)])
    list.selection.update([{ ...row(1), name: 'member' }, { ...row(3), name: 'outsider' }])
    expect(store.get(1)?.name).toBe('member')
    expect(store.get(3)?.name).toBe('row-3')
    store.delete(2)
    store.upsert(row(2))
    expect(list.ids.get()).toEqual([1])
    store.clear()
    store.upsert(row(1))
    expect(list.ids.get()).toEqual([])
    list.selection.remove(1)
    list.selection.clear()
  })

  it('maintains an ordered reactive registry and cascades disposal', () => {
    const { lists } = setup()
    let disposed = 0
    const lifecycle: EntityListPlugin<Row, number, Record<never, never>> = {
      membership: false,
      install(context) { context.onDispose(() => { disposed++ }); return {} },
    }
    const first = lists.create('first').use(allEntities()).use(lifecycle).build()
    const second = lists.create('second').use(allEntities()).use(lifecycle).build()
    expect(lists.keys.get()).toEqual(['first', 'second'])
    expect(lists.items.get()).toEqual([first, second])
    expect(lists.get('first')).toBe(first)
    expect(() => lists.create('first').use(allEntities()).build()).toThrow('already contains')
    expect(() => lists.group('second', lists.define((list, _args: {}) => list.use(allEntities())))).toThrow('already contains')
    expect(lists.delete('first')).toBe(true)
    expect(lists.keys.get()).toEqual(['second'])
    lists.dispose()
    lists.dispose()
    expect(disposed).toBe(2)
  })

  it('creates fresh ordered group instances from definition arguments', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2, 'b'), row(3)])
    const definition = lists.define((list, args: Filters) => list
      .use(allEntities())
      .use(filtering<Row, Filters>({ initial: args, predicate: (item, filters) => !filters.group || item.group === filters.group }))
      .use(sorting({ initial: { field: 'score' as const, direction: 'asc' as const }, compare })))
    const group = lists.group('groups', definition)
    const a = group.create('a', { group: 'a' })
    const b = group.create('b', { group: 'b' })
    expect(group.keys.get()).toEqual(['a', 'b'])
    expect(group.items.get()).toEqual([a, b])
    expect(a.ids.get()).toEqual([1, 3])
    expect(b.ids.get()).toEqual([2])
    a.filtering.patch({ group: null })
    expect(b.filtering.state.get()).toEqual({ group: 'b' })
    expect(() => group.create('a', { group: 'a' })).toThrow('already contains key')
    expect(group.delete('a')).toBe(true)
    group.clear()
    expect(group.items.get()).toEqual([])
    group.dispose()
  })

  it('extends EntityLists and rejects duplicate list plugin keys and memberships', () => {
    let disposed = 0
    const { store } = setup()
    const plugin: EntityListsPlugin<Row, number, { label: string }> = {
      install(context) { context.onDispose(() => { disposed++ }); return { label: 'rows' } },
    }
    const lists = entityLists(store).use(plugin).build()
    expect(lists.label).toBe('rows')
    const duplicateApi = { membership: false, install: () => ({ items: [] }) }
    expect(() => (lists.create('duplicate').use(allEntities()) as any).use(duplicateApi).build()).toThrow('already exists')
    expect(() => (lists.create('membership').use(allEntities()) as any).use(selection()).build()).toThrow('exactly one membership')
    expect(() => (lists.create('missing') as any).build()).toThrow('exactly one membership')
    lists.dispose()
    expect(disposed).toBe(1)
    expect(store.upsert(row(10))).toEqual(row(10))
  })

  it('prevents plugin installation after list and registry builders are built', () => {
    const { store, lists } = setup()
    const listBuilder = lists.create('built').use(allEntities())
    listBuilder.build()
    expect(() => (listBuilder as any).use({ membership: false, install: () => ({ extra: true }) })).toThrow('after build')

    const listsBuilder = entityLists(store)
    listsBuilder.build()
    expect(() => (listsBuilder as any).use({ install: () => ({ extra: true }) })).toThrow('after build')
  })
})
