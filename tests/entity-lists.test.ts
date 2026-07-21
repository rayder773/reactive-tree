import {
  allEntities,
  copies,
  data,
  entityLists,
  entityStore,
  filtering,
  identity,
  manual,
  query,
  queryLoading,
  readonlyData,
  selection,
  sorting,
  type EntityListsPlugin,
  type UniversalEntityListPlugin,
} from '../core'

interface Row { id: number; name: string; group: string; score: number }
interface Filters { group: string | null }
type Field = 'name' | 'score'
const row = (id: number, group = 'a'): Row => ({ id, name: `row-${id}`, group, score: id })
const compare = (left: Row, right: Row, field: Field) => field === 'name'
  ? left.name.localeCompare(right.name)
  : left.score - right.score

const setup = () => {
  const store = entityStore<Row>().use(identity((item) => item.id)).build()
  return { store, lists: entityLists(store) }
}

describe('entity lists', () => {
  it('creates the registry immediately and keeps allEntities reactive', () => {
    const { store, lists } = setup()
    const list = lists.create('all').use(allEntities()).build()
    store.upsertMany([row(1), row(2)])
    expect(list.ids.get()).toEqual([1, 2])
    const replacement = { ...row(1), name: 'replacement' }
    store.upsert(replacement)
    expect(list.items.get()[0]).toBe(replacement)
    expect(lists.keys.get()).toEqual(['all'])
  })

  it('supports explicit manual replace, append, prepend and id membership', () => {
    const { store, lists } = setup()
    const list = lists.create('manual').use(manual()).build()
    list.manual.replace([row(1), row(2), row(1)])
    list.manual.prepend([row(3)])
    list.manual.appendIds([4, 3])
    expect(list.ids.get()).toEqual([3, 1, 2])
    store.upsert(row(4))
    expect(list.ids.get()).toEqual([3, 1, 2, 4])
    list.manual.remove(1)
    expect(list.ids.get()).toEqual([3, 2, 4])
  })

  it('runs transforms in use order without named phases', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2), row(3)])
    const reverse: UniversalEntityListPlugin<Row, Record<never, never>> = {
      membership: false,
      install(context) { context.addTransform((items) => [...items].reverse()); return {} },
    }
    const list = lists.create('pipeline')
      .use(allEntities())
      .use(sorting({ initial: { field: 'score' as const, direction: 'desc' as const }, compare }))
      .use(reverse)
      .build()
    expect(list.ids.get()).toEqual([1, 2, 3])
  })

  it('replaces and appends query results and exposes nested services', async () => {
    const { lists } = setup()
    const source = query<Row, { page: number }>()
      .use(queryLoading())
      .request(async ({ input }) => input.page === 1 ? [row(1), row(2)] : [row(2), row(3)])
    const list = lists.create('remote').use(source).build()
    await list.query.replace({ page: 1 })
    await list.query.append({ page: 2 })
    expect(list.ids.get()).toEqual([1, 2, 3])
    expect(list.query.loading.state.get().status).toBe('idle')
  })

  it('creates argument-aware copies with independent plugin state', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2, 'b'), row(3)])
    const root = lists.create<Filters>('groups')
      .use(allEntities())
      .use((args) => filtering<Row, Filters>({
        initial: args,
        predicate: (item, filters) => !filters.group || item.group === filters.group,
      }))
      .use(sorting({ initial: { field: 'score' as const, direction: 'asc' as const }, compare }))
      .use(copies())
      .build({ group: 'a' })
    const second = root.copies.create('b', { group: 'b' })
    expect(root.ids.get()).toEqual([1, 3])
    expect(second.ids.get()).toEqual([2])
    root.filtering.patch({ group: null })
    expect(second.filtering.state.get()).toEqual({ group: 'b' })
    expect(root.copies.keys.get()).toEqual(['b'])
    root.copies.delete('b')
  })

  it('supports single and multiple selection without changing membership', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2), row(3)])
    const single = lists.create('single').use(allEntities()).use(selection({ mode: 'single' })).build()
    single.selection.selectFirst()
    expect(single.selection.id.get()).toBe(1)
    single.selection.select(2)
    expect(single.selection.item.get()).toBe(store.get(2))

    const multiple = lists.create('multiple').use(allEntities()).use(selection({ mode: 'multiple' })).build()
    multiple.selection.selectAll()
    multiple.selection.toggle(2)
    expect(multiple.selection.ids.get()).toEqual([1, 3])
    store.delete(1)
    expect(multiple.selection.ids.get()).toEqual([3])
  })

  it('installs registry plugins without a registry build step', () => {
    const { store } = setup()
    let disposed = 0
    const plugin: EntityListsPlugin<Row, number, { label: string }> = {
      install(context) { context.onDispose(() => { disposed++ }); return { label: 'rows' } },
    }
    const lists = entityLists(store).use(plugin)
    expect(lists.label).toBe('rows')
    lists.dispose()
    expect(disposed).toBe(1)
  })

  it('keeps filtering and sorting state reactive', () => {
    const { store, lists } = setup()
    store.upsertMany([row(1), row(2, 'b')])
    const list = lists.create('state')
      .use(allEntities())
      .use(filtering<Row, Filters>({ initial: { group: 'a' }, predicate: (item, value) => item.group === value.group }))
      .use(sorting({ initial: { field: 'name' as const, direction: 'asc' as const }, compare }))
      .build()
    const observed = data(list.ids.get())
    const unsubscribe = list.ids.subscribe((value) => observed.set(value))
    list.filtering.set({ group: 'b' })
    expect(readonlyData(observed).get()).toEqual([2])
    unsubscribe()
  })
})

const typeContracts = () => {
  const store = entityStore<Row>().use(identity((item) => item.id)).build()
  const lists = entityLists(store)
  // @ts-expect-error a list requires one source plugin
  lists.create('missing-source').build()
  // @ts-expect-error allEntities and manual are conflicting sources
  lists.create('double-source').use(allEntities()).use(manual())

  const single = lists.create('typed-single').use(allEntities()).use(selection({ mode: 'single' })).build()
  // @ts-expect-error toggle belongs only to multiple selection
  single.selection.toggle(1)

  const root = lists.create<Filters>('typed-copies').use(allEntities()).use(copies()).build({ group: 'a' })
  // @ts-expect-error copy args must match the root declaration
  root.copies.create('wrong', { group: 1 })

  const queryBuilder = query<Row>().use(queryLoading())
  // @ts-expect-error duplicate query service API keys are rejected
  queryBuilder.use(queryLoading())
}
void typeContracts
