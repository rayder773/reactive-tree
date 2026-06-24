import { computed, reactive, ref, toRaw, type ComputedRef } from 'vue'
import type { AnyNode } from './types'

export type DependencyTargetProp =
  | 'value'
  | 'exists'
  | 'valid'
  | 'errors'
  | 'warnings'
  | 'diagnostics'
  | 'items'
  | 'byKey'
  | 'status'
  | 'error'
  | 'unknown'

export type DependencyReason =
  | 'computed'
  | 'when'
  | 'switchNode'
  | 'list.from'
  | 'record.from'
  | 'check'

export interface DebugNodeInfo {
  id: string
  path: string
  kind: string
  label?: string
  active: boolean
}

export interface DependencyEdge {
  readerId: string
  targetId: string
  targetProp: DependencyTargetProp
  reason: DependencyReason
  createdAtRunId: number
}

export interface DependencyGraph {
  nodes: DebugNodeInfo[]
  edges: Array<{
    from: string
    to: string
    prop: DependencyTargetProp
    reason: DependencyReason
  }>
}

type ActiveReader = {
  readerId: string
  reason: DependencyReason
  runId: number
}

export interface DebugStore {
  nodes: ComputedRef<DebugNodeInfo[]>
  edges: ComputedRef<DependencyEdge[]>
  registerNode(node: AnyNode, info: Omit<DebugNodeInfo, 'active'> & { active?: boolean }): void
  setNodeActive(id: string, active: boolean): void
  startReader(input: { readerId: string; reason: DependencyReason }): void
  endReader(): void
  trackRead(input: { targetId: string; targetProp: DependencyTargetProp }): void
  runWithReader<T>(input: { readerId: string; reason: DependencyReason }, fn: () => T): T
  readsOf(nodeOrId: string | AnyNode): string[]
  readBy(nodeOrId: string | AnyNode): string[]
  getEdges(): DependencyEdge[]
  getNodes(): DebugNodeInfo[]
  getDependencyGraph(): DependencyGraph
  createSelfProxy(root: AnyNode): any
}

function nodeId(nodeOrId: string | AnyNode): string {
  return typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.__debug.id
}

function edgeKey(edge: Pick<DependencyEdge, 'readerId' | 'targetId' | 'targetProp' | 'reason'>): string {
  return `${edge.readerId}\u0000${edge.targetId}\u0000${edge.targetProp}\u0000${edge.reason}`
}

function isTrackableNode(value: unknown): value is AnyNode {
  return Boolean(
    value &&
      typeof value === 'object' &&
      '__debug' in value &&
      (value as AnyNode).__debug?.id,
  )
}

export function createDebugStore(): DebugStore {
  const nodesById = reactive(new Map<string, DebugNodeInfo>())
  const edgesByKey = reactive(new Map<string, DependencyEdge>())
  const conditionalNodeIds = new Set<string>()
  const activeReaderStack: ActiveReader[] = []
  let runId = 0
  const proxyCache = new WeakMap<object, any>()

  const store: DebugStore = {
    nodes: computed(() => Array.from(nodesById.values())),
    edges: computed(() => Array.from(edgesByKey.values())),

    registerNode(node, info) {
      const id = info.id
      const nextInfo: DebugNodeInfo = {
        id,
        path: info.path,
        kind: info.kind,
        label: info.label,
        active: info.active ?? true,
      }

      nodesById.set(id, nextInfo)

      if (info.kind === 'when' || info.kind === 'switch') {
        conditionalNodeIds.add(id)
      }

      Object.defineProperty(node, '__debug', {
        enumerable: false,
        configurable: true,
        value: nextInfo,
      })
    },

    setNodeActive(id, active) {
      const info = nodesById.get(id)

      if (info) {
        nodesById.set(id, { ...info, active })
      }
    },

    startReader(input) {
      const nextRunId = runId + 1
      runId = nextRunId

      for (const [key, edge] of Array.from(toRaw(edgesByKey).entries())) {
        if (edge.readerId === input.readerId) {
          edgesByKey.delete(key)
        }
      }

      activeReaderStack.push({
        readerId: input.readerId,
        reason: input.reason,
        runId: nextRunId,
      })
    },

    endReader() {
      activeReaderStack.pop()
    },

    trackRead(input) {
      const activeReader = activeReaderStack.at(-1)

      if (!activeReader || activeReader.readerId === input.targetId) {
        return
      }

      const edge: DependencyEdge = {
        readerId: activeReader.readerId,
        targetId: input.targetId,
        targetProp: input.targetProp,
        reason: activeReader.reason,
        createdAtRunId: activeReader.runId,
      }

      edgesByKey.set(edgeKey(edge), edge)
    },

    runWithReader(input, fn) {
      store.startReader(input)

      try {
        return fn()
      } finally {
        store.endReader()
      }
    },

    readsOf(nodeOrId) {
      const id = nodeId(nodeOrId)
      return store.edges.value
        .filter(edge => edge.readerId === id)
        .map(edge => `${edge.targetId}.${edge.targetProp}`)
    },

    readBy(nodeOrId) {
      const id = nodeId(nodeOrId)
      return Array.from(
        new Set(
          store.edges.value
            .filter(edge => edge.targetId === id)
            .map(edge => edge.readerId),
        ),
      )
    },

    getEdges() {
      return store.edges.value
    },

    getNodes() {
      return store.nodes.value
    },

    getDependencyGraph() {
      return {
        nodes: store.nodes.value,
        edges: store.edges.value.map(edge => ({
          from: edge.readerId,
          to: edge.targetId,
          prop: edge.targetProp,
          reason: edge.reason,
        })),
      }
    },

    createSelfProxy(root) {
      const wrap = (value: unknown): unknown => {
        if (!isTrackableNode(value)) {
          return value
        }

        if (proxyCache.has(value)) {
          return proxyCache.get(value)
        }

        const proxy = new Proxy(value, {
          get(target, property, receiver) {
            if (property === '__rawNode') {
              return target
            }

            if (property === 'value') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'value' })
            } else if (property === 'valid') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'valid' })
            } else if (property === 'errors') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'errors' })
            } else if (property === 'warnings') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'warnings' })
            } else if (property === 'diagnostics') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'diagnostics' })
            } else if (property === 'items') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'items' })
            } else if (property === 'byKey') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'byKey' })
            } else if (property === 'status') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'status' })
            } else if (property === 'error') {
              store.trackRead({ targetId: target.__debug.id, targetProp: 'error' })
            }

            const child = Reflect.get(target, property, receiver)
            const childId = typeof property === 'string'
              ? target.__debug.id && target.__debug.id !== 'root'
                ? `${target.__debug.id}.${property}`
                : property
              : undefined

            if (
              typeof property === 'string' &&
              !property.startsWith('__') &&
              child === undefined
            ) {
              if (childId && toRaw(nodesById).has(childId)) {
                store.trackRead({ targetId: childId, targetProp: 'exists' })
              }
            }

            if (isTrackableNode(child) && conditionalNodeIds.has(child.__debug.id)) {
              store.trackRead({ targetId: child.__debug.id, targetProp: 'exists' })
            }

            if (typeof child === 'function' && property === 'byKey') {
              return (...args: unknown[]) => wrap(child.apply(target, args))
            }

            return wrap(child)
          },
        })

        proxyCache.set(value, proxy)
        return proxy
      }

      return wrap(root)
    },
  }

  return store
}
