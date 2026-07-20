# Reactive Tree

A small framework-agnostic reactive core, normalized entity service, and a single Vite host for independently mounted example applications.

## Architecture

- `core/data` provides synchronous shallow reactive values with explicit readonly facades.
- `core/services` contains independent loading, abort, sorting, filtering, and pagination state owners.
- `core/entity` normalizes entities in one map and builds entity-backed or query-backed list views with client/server processing capabilities.
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

## Core usage

```ts
import { EntityService, data, readonlyData } from 'reactive-tree'

const count = data(0)
const publicCount = readonlyData(count)

const users = new EntityService({
  getId: (user: { id: number; name: string }) => user.id,
  queryById: async (id, signal) =>
    fetch(`/users/${id}`, { signal }).then((response) => response.json()),
})
```

Choose the state implementation once at the application boundary:

```ts
import { vueDataAdapter } from './adapters/vue'
import { setDataAdapter } from 'reactive-tree'

setDataAdapter(vueDataAdapter)

const users = new EntityService({ getId: (user: { id: number }) => user.id })
```

All new state uses the configured adapter directly; services and capability factories do not receive or store it.

The Vue adapter creates ref-compatible data, so top-level bindings are automatically unwrapped in templates. A binding such as `const entities = users.entities` can be rendered as `entities.size`; arrays can be used directly in `v-for`. The framework-level `get()` API remains available in domain code and outside Vue templates.
