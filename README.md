# Reactive Tree

A small framework-agnostic reactive core with normalized entity storage, composable entity-list views, and a single Vite host for independently mounted example applications.

## Architecture

- `core/data` provides synchronous shallow reactive values with explicit readonly facades.
- `core/entity` provides a synchronous `EntityStore`, a separate `EntityLists` registry, and typed plugins for list membership and transforms.
- `adapters/vue`, `adapters/react`, and `adapters/svelte` connect framework-neutral data to each UI library. The root package entry never imports a UI framework.
- `examples/apps` contains framework-neutral application domains, while `examples/ui` contains independently loaded Vue, React, and Svelte renderers.
- `examples/host` is a vanilla TypeScript shell that selects the application and its UI renderer independently.

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

const lists = entityLists(users)

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

Every list installs exactly one source plugin. `allEntities()` follows the complete entity store, `manual()` owns an explicitly managed sequence, and `query()` fills the list from asynchronous requests. Client transforms run in `.use()` order, so the core does not know which services exist. Each plugin exposes its API at a named facade key and duplicate keys are rejected.

Plugins may only be added to builders. Calling `.build()` freezes composition and creates list-local plugin state.

### Manual and queried lists

```ts
import { manual } from 'reactive-tree'

const favorites = lists.create('favorites').use(manual()).build()

favorites.manual.append([{ id: 1, name: 'Ada', team: 'platform' }])
favorites.manual.prependIds([3, 2])
favorites.manual.update([{ id: 1, name: 'Updated', team: 'platform' }])
favorites.manual.remove(2)
```

Entity commands fully upsert their input. ID-only commands can retain unknown IDs; those IDs appear in `items` once their entities enter the store. IDs are deduplicated, and append/prepend do not move IDs already present.

Queries compose their own services and expose them below `list.query`:

```ts
import { query, queryConcurrencyLatest, queryLoading, querySorting } from 'reactive-tree'

const remoteUsers = lists.create('remote-users').use(
  query<User>()
    .use(queryLoading())
    .use(queryConcurrencyLatest({ cancelPrevious: true }))
    .use(querySorting({ field: 'name' as const, direction: 'asc' }))
    .request(({ sorting, signal }) => repository.query({ sorting: sorting.state.get() }, signal)),
).build()

await remoteUsers.query.replace()
await remoteUsers.query.append()
```

Queries use parallel concurrency by default. The built-in alternatives are
`queryConcurrencyLatest`, `queryConcurrencyQueue`, and
`queryConcurrencyExhaust`. Every query exposes its strategy and reactive
operation IDs through `query.concurrency.activeIds` and `pendingIds`; use
`cancel(operationId)` or `cancelAll()` for manual cancellation. `replace` and
`append` resolve to an applied/skipped result carrying the operation ID.

Custom scheduling is installed with `queryConcurrency(() => service)`. A
service implements `QueryConcurrencyService` and may use RxJS `Subject` plus
`switchMap`, `mergeMap`, `concatMap`, or `exhaustMap`; RxJS is intentionally
not a library dependency. Custom services own their `AbortService` and must
implement cancellation and disposal.

`replace` changes only list membership; normalized entities that are no longer visible remain in the store. Changing query service state does not automatically send a request.

The repository helpers under `core/services/repository` provide typed real/mock selection and composable scenarios. Copy `.default.env` to the ignored `.env` for local overrides; `VITE_MOCK`, `VITE_SCENARIO`, and a repository-specific `VITE_*_SCENARIO` select the implementation and scenario.

## Typed copies and row selection

`copies()` recreates every plugin for each entry. Argument-dependent plugins use a factory, so reset values also belong to that copy:

```ts
interface TeamArgs { team: string }

const platform = lists.create<TeamArgs>('platform')
  .use(allEntities())
  .use((args) => filtering({
    initial: { team: args.team },
    predicate: (user, filters) => user.team === filters.team,
  }))
  .use(copies())
  .build({ team: 'platform' })

const design = platform.copies.create('design', { team: 'design' })
```

Row selection is independent from the list source. `selection({ mode: 'single' })` exposes radio-style `id/item`; multiple mode exposes `ids/items`, `toggle`, and `selectAll`. Both modes provide `selectFirst`, `clear`, `keepVisible`, and `isSelected`. Requests preserve selection unless the application explicitly changes it.

Deleting a root list disposes its copies. `lists.dispose()` disposes all lists but intentionally leaves `users` alive; application teardown should dispose lists first and then the store.

## Data adapter

Each framework entry chooses the state implementation before the host creates the application domain:

```ts
import { vueDataAdapter } from './adapters/vue'
import { setDataAdapter } from 'reactive-tree'

export function createRenderer() {
  setDataAdapter(vueDataAdapter)
  // Return the framework-specific mount/unmount implementation.
}
```

Each UI entry installs its adapter before the host creates the application domain. UI components use the same explicit `.value` API in every framework, while domain logic can use `get()`:

```tsx
const entities = domain.entities.entities
const sorting = domain.allParts.query.sorting.state

return <div>{entities.value.size} entities, sorted {sorting.value.direction}</div>
```

The Vue adapter tracks `.value` through `shallowRef`, the React adapter rerenders `ReactDataRoot` through `useSyncExternalStore`, and the Svelte adapter stores `.value` in `$state.raw`. No per-value framework bindings are needed.

## Register applications and UI libraries

Application registrations create only framework-neutral state:

```ts
{
  id: 'my-app',
  title: 'My application',
  description: 'A framework-neutral example.',
  create: createMyDomain,
}
```

Every domain implements `dispose()`. UI libraries are registered separately and lazily map application IDs to renderers:

```ts
{
  id: 'react',
  title: 'React',
  renderers: {
    'my-app': async () => (await import('../ui/react/my-app/entry')).createRenderer,
  },
}
```

A renderer factory installs its framework adapter and returns an object with `mount({ container, application })` and idempotent `unmount()`. The host loads and invokes that factory before creating the domain. Switching either the application or UI library disposes the current domain and creates a new one with the selected adapter.
