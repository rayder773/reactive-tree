# Reactive Tree

Small TypeScript runtime for application architecture experiments.

This is not a UI framework and not an application framework. It provides a central runtime for creating stores, services, registered objects, lifecycle events, and plugins.

## Core Idea

Everything should be created or registered through one runtime:

```ts
import { createAppRuntime, dependencyGraphPlugin } from './index'

const graph = dependencyGraphPlugin()

const app = createAppRuntime({
	plugins: [graph],
})
```

The runtime is responsible for:

- creating stores
- creating infrastructure services
- registering objects
- wrapping methods and stores
- notifying plugins about lifecycle events
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

## Registration

Domain objects are registered through the runtime:

```ts
const workflow = app.register(new UserWorkflow(users, loading), {
	dependencies: [users, loading],
})
```

`dependencies` are declarative architecture dependencies. They are visible before any method is called.

Runtime method calls are observed automatically after registration:

```ts
await workflow.loadUser('user-1')
```

## Dependency Graph Plugin

`dependencyGraphPlugin()` observes runtime lifecycle events and builds a graph.

It tracks:

- registered objects
- declared dependencies
- method calls
- nested calls
- async callback boundaries
- store reads
- store writes
- store deletes

Print the graph:

```ts
graph.print()
```

Read it programmatically:

```ts
const snapshot = graph.getSnapshot()
```

Store operations include store name, key, and short value summary:

```txt
LoadingStore.set(load-user:user-1 = loading)
LoadingStore.set(load-user:user-1 = idle)
UsersStore.set(user-1 = Object)
TodosStore.set(page:1|todos|user-1 = Array(1))
```

Detailed event logging is disabled by default. Enable it only when needed:

```ts
dependencyGraphPlugin({ trace: true })
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
