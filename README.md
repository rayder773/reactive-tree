# Reactive Tree

A small framework-agnostic reactive core with normalized entity storage, composable entity-list views, and a single Vite host for independently mounted example applications.

## Architecture

- `core/data` provides synchronous shallow reactive values with explicit readonly facades.
- `core/entity` provides a synchronous `EntityStore`, a separate `EntityLists` registry, and typed plugins for list membership and transforms.
- `adapters/vue` provides a Vue-backed `DataAdapter`. The root package entry never imports Vue.
- `examples/host` is a vanilla TypeScript application shell. Each app is loaded lazily and implements the same mount/unmount contract.

Objects, arrays, and maps are shallow values: update them by supplying a new value instead of mutating them in place.

## Commands

```sh
npm run dev
npm run build
npm test
npm run typecheck
```

## Entity storage

Create a store by installing its identity plugin before building it:

```ts
import { entityStore, identity } from 'reactive-tree'

interface User {
  id: number
  name: string
  team: string
}

const users = entityStore<User>()
  .use(identity((user) => user.id))
  .build()

users.upsert({ id: 1, name: 'Ada', team: 'platform' })
users.update(1, (user) => ({ ...user, name: 'Ada Lovelace' }))
```

`upsert` and `upsertMany` replace an existing entity completely. `entities`, `get`, `has`, and `values` always expose the normalized values; `update` rejects an ID change. The store is deliberately synchronous and has no request, loading, abort, or pagination behavior.

## Lists and plugins

Lists have a separate owner and share entity object references with their store:

```ts
import { allEntities, entityLists, filtering, sorting } from 'reactive-tree'

const lists = entityLists(users).build()

const platformUsers = lists
  .create('platform-users')
  .use(sorting({
    initial: { field: 'name' as const, direction: 'asc' },
    compare: (left, right) => left.name.localeCompare(right.name),
  }))
  .use(allEntities())
  .use(filtering({
    initial: { team: 'platform' },
    predicate: (user, filters) => user.team === filters.team,
  }))
  .build()

platformUsers.sorting.setDirection('desc')
platformUsers.filtering.patch({ team: 'design' })
```

Every list must install exactly one membership plugin: `allEntities()` observes all store entities, while `selection()` owns an ordered set of IDs and adds `list.selection`. Filtering always runs before sorting, followed by custom final transforms, regardless of `.use()` order. Plugins in the same phase retain installation order. Each plugin exposes its API at a named facade key and duplicate keys are rejected.

Plugins may only be added to builders. Calling `.build()` freezes composition and creates list-local plugin state.

### Selection lists

```ts
import { selection } from 'reactive-tree'

const favorites = lists.create('favorites').use(selection()).build()

favorites.selection.append([{ id: 1, name: 'Ada', team: 'platform' }])
favorites.selection.prependIds([3, 2])
favorites.selection.update([{ id: 1, name: 'Updated', team: 'platform' }])
favorites.selection.remove(2)
```

Entity commands fully upsert their input. ID-only commands can retain unknown IDs; those IDs appear in `items` once their entities enter the store. IDs are deduplicated, and append/prepend do not move IDs already present.

## Definitions and dynamic groups

A definition runs its factory for each group entry, producing fresh plugin instances and independent state:

```ts
interface TeamArgs { team: string }

const teamDefinition = lists.define<TeamArgs>(
  (list, args: TeamArgs) => list
    .use(allEntities())
    .use(filtering({
      initial: { team: args.team },
      predicate: (user, filters) => user.team === filters.team,
    }))
    .use(sorting({
      initial: { field: 'name' as const, direction: 'asc' },
      compare: (left, right) => left.name.localeCompare(right.name),
    })),
)

const teamViews = lists.group('teams', teamDefinition)
teamViews.create('platform', { team: 'platform' })
teamViews.create('design', { team: 'design' })
```

Both `EntityLists` and groups expose reactive ordered `keys` and `items`. Deleting an entry disposes that list. `lists.dispose()` disposes all ordinary lists and groups but intentionally leaves `users` alive; application teardown should dispose lists first and then the store.

## Data adapter

Choose the state implementation once at the application boundary:

```ts
import { vueDataAdapter } from './adapters/vue'
import { setDataAdapter } from 'reactive-tree'

setDataAdapter(vueDataAdapter)
```

The Vue adapter creates ref-compatible data, so top-level bindings are automatically unwrapped in templates. The framework-level `get()` API remains available in domain code and outside Vue templates.

## Register an application

Add metadata and a lazy loader to `examples/host/registry.ts`:

```ts
{
  id: 'my-app',
  title: 'My application',
  description: 'An independently mounted example.',
  load: async () => (await import('../apps/my-app/entry')).createApplication(),
}
```

The entry module returns an object with `mount({ container })` and idempotent `unmount()` methods. Framework setup belongs inside `mount`, so loading one application does not initialize another.
