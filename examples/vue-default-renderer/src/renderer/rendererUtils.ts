import type {
  AnyNode,
  AsyncNode,
  Check,
  ComputedNode,
  Diagnostic,
  ListNode,
  RecordNode,
  SectionNode,
  StateNode,
} from '../../../../src'

const NODE_INTERNAL_KEYS = new Set([
  'kind',
  'label',
  'metadata',
  'checks',
  'value',
  'valid',
  'invalid',
  'diagnostics',
  'errors',
  'warnings',
  'items',
  'byKey',
  'set',
  'reset',
  'status',
  'error',
  'refetch',
  '__register',
])

export type NodeEntry = {
  key: string
  node: AnyNode
}

export type ControlKind =
  | 'checkboxGroup'
  | 'select'
  | 'file'
  | 'checkbox'
  | 'number'
  | 'text'

export function isNode(value: unknown): value is AnyNode {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'kind' in value &&
      typeof (value as { kind?: unknown }).kind === 'string',
  )
}

export function isStateNode(node: AnyNode): node is StateNode<unknown> {
  return node.kind === 'state' && typeof node.set === 'function'
}

export function isComputedNode(node: AnyNode): node is ComputedNode<unknown> {
  return node.kind === 'computed'
}

export function isSectionNode(node: AnyNode): node is SectionNode<any> {
  return node.kind === 'section'
}

export function isListNode(node: AnyNode): node is ListNode<AnyNode> {
  return node.kind === 'list'
}

export function isRecordNode(node: AnyNode): node is RecordNode<AnyNode> {
  return node.kind === 'record'
}

export function isAsyncNode(node: AnyNode): node is AsyncNode<unknown> {
  return node.kind === 'async'
}

export function childEntries(node: AnyNode): NodeEntry[] {
  return Object.keys(node)
    .filter(key => !NODE_INTERNAL_KEYS.has(key))
    .map(key => ({ key, node: node[key] }))
    .filter((entry): entry is NodeEntry => isNode(entry.node))
}

export function listEntries(node: ListNode<AnyNode>): NodeEntry[] {
  return node.items.value.map((item, index) => ({
    key: String(index),
    node: item,
  }))
}

export function recordEntries(node: RecordNode<AnyNode>): NodeEntry[] {
  return Object.entries(node.items.value)
    .map(([key, item]) => ({ key, node: item }))
    .filter((entry): entry is NodeEntry => isNode(entry.node))
}

export function nodeTitle(node: AnyNode, fallback: string): string {
  return node.label || fallback
}

export function stringifyValue(value: unknown): string {
  if (value instanceof File) {
    return value.name
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function diagnosticsByLevel(
  diagnostics: readonly Diagnostic[],
  level: Diagnostic['level'],
): Diagnostic[] {
  return diagnostics.filter(diagnostic => diagnostic.level === level)
}

export function checkMetadata(node: AnyNode, kind: string): unknown | undefined {
  return node.checks?.find(item => checkKind(item) === kind)?.metadata
}

export function checkKind(check: Check<any>): string | undefined {
  const metadata = check.metadata

  if (metadata && typeof metadata === 'object' && 'kind' in metadata) {
    return String((metadata as { kind: unknown }).kind)
  }

  return undefined
}

function optionsFromMetadata(metadata: unknown, root: AnyNode): unknown[] | undefined {
  if (!metadata || typeof metadata !== 'object' || !('values' in metadata)) {
    return undefined
  }

  const valuesOrGetter = (metadata as { values: unknown }).values

  if (Array.isArray(valuesOrGetter)) {
    return [...valuesOrGetter]
  }

  if (typeof valuesOrGetter === 'function') {
    const values = valuesOrGetter(root)
    return Array.isArray(values) ? [...values] : undefined
  }

  return undefined
}

export function oneOfOptions(node: AnyNode, root: AnyNode): unknown[] | undefined {
  return optionsFromMetadata(checkMetadata(node, 'oneOf'), root)
}

export function manyOfOptions(node: AnyNode, root: AnyNode): unknown[] | undefined {
  const metadata = checkMetadata(node, 'manyOf')

  if (!metadata || typeof metadata !== 'object' || !('values' in metadata)) {
    return undefined
  }

  return optionsFromMetadata(metadata, root)
}

export function hasFileTypeCheck(node: AnyNode): boolean {
  return checkMetadata(node, 'fileType') !== undefined
}

export function controlKind(node: AnyNode, root: AnyNode): ControlKind {
  if (Array.isArray(node.value) && manyOfOptions(node, root)) {
    return 'checkboxGroup'
  }

  if (oneOfOptions(node, root)) {
    return 'select'
  }

  if (hasFileTypeCheck(node)) {
    return 'file'
  }

  if (typeof node.value === 'boolean') {
    return 'checkbox'
  }

  if (typeof node.value === 'number') {
    return 'number'
  }

  return 'text'
}
