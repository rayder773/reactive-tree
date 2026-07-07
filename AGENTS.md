# Agent Instructions

## Verification

- Do not run build, test, lint, typecheck, formatting, or other verification scripts after edits unless the user explicitly asks for them.
- If verification would normally be useful, mention the exact command that could be run instead of running it.

## Debug Logging

- When asked to add console logs, log minimal scalar fields by default.
- Avoid logging large objects, arrays, proxies, stores, graphs, AST nodes, DOM nodes, or full reactive nodes unless the user explicitly asks for them or the task clearly requires object inspection.
- Prefer targeted logs like IDs, booleans, counts, labels, paths, status values, and short stringified summaries.
- If an object or array is necessary, log only selected fields or a small mapped subset.
- After adding temporary logs, do not remove them immediately after the user shares log output. Keep them until the user explicitly says the debugging is done or asks to remove them.

Prefer:

```ts
console.debug('deps', {
	readerId,
	depCount: deps.length,
	depLabels: deps.map((dep) => dep.label),
})
```

Avoid:

```ts
console.debug('deps', deps)
console.debug('store', store)
console.debug('node', node)
```
