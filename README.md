# Reactive Tree

Small TypeScript runtime for application architecture experiments.

This is not a UI framework and not an application framework. It provides a central runtime for creating stores, services, and store-based plugins.

## Core Idea

Stores and shared services are created through one runtime:

```ts
import { createAppRuntime } from './index'

const app = createAppRuntime()
```

The runtime is responsible for:

- creating stores
- creating infrastructure services
- wrapping stores
- notifying plugins about store reads and writes
- supporting future extensions without changing services

## Store

There is one store abstraction. It always behaves like keyed storage:

```ts
const users = app.createStore<User>({ name: 'UsersStore' })

users.set(user, user.id)
users.get(user.id)
users.has(user.id)
users.delete(user.id)
users.clear()
```

If no key is passed, the store uses an internal default key:

```ts
const settings = app.createStore<AppSettings>({ name: 'SettingsStore' })

settings.set({ theme: 'dark' })
settings.get()
```

Array keys are supported and normalized. Order does not matter:

```ts
todos.set(items, ['todos', 'user-1', 'page:1'])

todos.get(['page:1', 'todos', 'user-1'])
```

## Services

Services do not own state. They receive stores through dependency injection.

Available services:

- `LoadingService`
- `AbortService`
- `PaginationService`

Example:

```ts
const loading = app.createLoadingService()

await loading.run(async () => {
	await fetchUser()
}, 'load-user:user-1')
```

`LoadingService` stores:

- `loading` before callback
- `idle` after success
- `error` after failure

`AbortService` aborts the previous controller for the same key:

```ts
await abort.run(async (signal) => {
	await fetch('/api/users/1', { signal })
}, 'load-user:user-1')
```

## Examples

Run the examples host:

```sh
npm run dev
```

The examples host lives in `examples/` and loads examples through a small public contract. Each example exports its own metadata and `mount()` function, so the host does not depend on example internals.

## Checks

```sh
npm run check
npm run typecheck
npm test -- --run
```
