import type { ComputedRef } from 'vue'

export type DiagnosticLevel = 'error' | 'warning' | 'info'

export interface Diagnostic {
  level: DiagnosticLevel
  code: string
  message: string
  payload?: unknown
}

export type CheckMode = 'block' | 'error' | 'warning' | 'meta'

export interface CheckResult {
  diagnostic?: Diagnostic | Diagnostic[] | null
  metadata?: unknown
  block?: boolean
}

export interface CheckContext {
  root: any
  node: AnyNode
  phase: 'set' | 'validate'
}

export interface Check<T = unknown> {
  mode: CheckMode
  metadata?: unknown
  run(value: T, context: CheckContext): CheckResult | Diagnostic | Diagnostic[] | null | undefined
}

export interface NodeOptions<T = unknown> {
  label?: string
  checks?: Array<Check<T> | null | undefined | false>
  metadata?: unknown
}

export interface NodeSpec<TNode, TOptional extends boolean = false> {
  __node?: TNode
  __optional?: TOptional
  build(context: BuildContext): TNode
}

export interface BuildContext {
  root: any
  registerNode?: (node: AnyNode) => void
}

export interface BaseNode<TValue = unknown> {
  readonly kind: string
  readonly label?: string
  readonly metadata?: unknown
  readonly value: TValue
  readonly valid: ComputedRef<boolean>
  readonly invalid: ComputedRef<boolean>
  readonly diagnostics: ComputedRef<Diagnostic[]>
  readonly errors: ComputedRef<Diagnostic[]>
  readonly warnings: ComputedRef<Diagnostic[]>
}

export interface StateNode<T> extends BaseNode<T> {
  readonly kind: 'state'
  readonly value: T
  set(value: T): boolean
  reset(): void
}

export interface ComputedNode<T> extends BaseNode<T> {
  readonly kind: 'computed'
  readonly value: T
}

export type SectionChildren = Record<string, NodeSpec<any, any>>

export type SpecNode<T> = T extends NodeSpec<infer TNode, infer TOptional>
  ? TOptional extends true
    ? TNode | undefined
    : TNode
  : never

export type SectionNode<TChildren extends SectionChildren> = BaseNode<{
  [K in keyof TChildren as undefined extends SpecNode<TChildren[K]> ? never : K]: NodeValue<SpecNode<TChildren[K]>>
} & {
  [K in keyof TChildren as undefined extends SpecNode<TChildren[K]> ? K : never]?: NodeValue<Exclude<SpecNode<TChildren[K]>, undefined>>
}> & {
  readonly kind: 'section'
} & {
  readonly [K in keyof TChildren]: SpecNode<TChildren[K]>
}

export interface ListNode<TItemNode extends AnyNode = AnyNode> extends BaseNode<NodeValue<TItemNode>[]> {
  readonly kind: 'list'
  readonly items: ComputedRef<TItemNode[]>
  byKey(key: PropertyKey): TItemNode | undefined
}

type RecordDynamicProps<TItemNode extends AnyNode, TKey extends string> = [TKey] extends [never]
  ? object
  : { readonly [K in TKey]: TItemNode }

export type RecordNode<TItemNode extends AnyNode = AnyNode, TKey extends string = string> =
  BaseNode<Record<string, NodeValue<TItemNode>>> & {
    readonly kind: 'record'
    readonly items: ComputedRef<Record<string, TItemNode>>
    byKey(key: string): TItemNode | undefined
  } & RecordDynamicProps<TItemNode, TKey>

export type AnyNode = BaseNode<any> & {
  readonly kind: string
  readonly [key: string]: any
}

export type NodeValue<TNode> = TNode extends { value: infer TValueRef }
  ? TValueRef
  : never

export type TreeNode<TChildren extends SectionChildren> = SectionNode<TChildren>
