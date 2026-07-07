import { computed as vueComputed } from 'vue'
import { state } from '../nodes/state'
import {
	childPath,
	diagnosticsRefs,
	emptyDiagnosticsRefs,
	nodeDiagnostics,
	registerDebugNode,
} from '../nodes/utils'
import { resolveMaybeWhen } from '../nodes/when'
import type {
	BaseNode,
	BuildContext,
	NodeSpec,
	NodeValue,
	SectionChildren,
	SpecNode,
} from '../types'
import type { InputNode } from './input'

export type FormGetter<T> = (self: FormNode<any>) => T

export interface FormConfig {
	disabled?: FormGetter<boolean>
	isSubmitting?: FormGetter<boolean>
	[key: string]: FormGetter<unknown> | undefined
}

export type FormNode<TChildren extends SectionChildren> = BaseNode<
	{
		[K in keyof TChildren as undefined extends SpecNode<TChildren[K]>
			? never
			: K]: NodeValue<SpecNode<TChildren[K]>>
	} & {
		[K in keyof TChildren as undefined extends SpecNode<TChildren[K]>
			? K
			: never]?: NodeValue<Exclude<SpecNode<TChildren[K]>, undefined>>
	}
> & {
	readonly kind: 'form'
	readonly isAnyTouched: { value: boolean }
	readonly isAnyDirty: { value: boolean }
	readonly isSubmitting: { value: boolean }
	readonly disabled: { value: boolean }
} & {
	readonly [K in keyof TChildren]: SpecNode<TChildren[K]>
}

function collectInputNodes(
	nodes: Record<string, any>,
): Array<InputNode | FormNode<any>> {
	const result: Array<InputNode | FormNode<any>> = []
	for (const node of Object.values(nodes)) {
		const resolved = resolveMaybeWhen(node)
		if (!resolved) continue
		if (resolved.kind === 'input' || resolved.kind === 'form') {
			result.push(resolved as InputNode | FormNode<any>)
		}
	}
	return result
}

export function form<TChildren extends SectionChildren>(
	children: TChildren,
	config: FormConfig = {},
): NodeSpec<FormNode<TChildren>> {
	return {
		build(context: BuildContext): FormNode<TChildren> {
			const node: any = {
				kind: 'form' as const,
			}

			const childNodes: Record<string, any> = {}

			registerDebugNode(context, node, 'form', true, (config as any).__source)
			context.registerNode?.(node)

			for (const key of Object.keys(children)) {
				Object.defineProperty(node, key, {
					enumerable: true,
					configurable: true,
					get: () => resolveMaybeWhen(childNodes[key]),
				})

				const child = (children[key] as NodeSpec<any>).build({
					...context,
					path: childPath(context.path, key),
					registerNode: (earlyNode) => {
						childNodes[key] = earlyNode
					},
				})
				childNodes[key] = child
			}

			const isAnyTouchedRef = vueComputed(() => {
				return collectInputNodes(childNodes).some((n) => {
					if (n.kind === 'input') return (n as InputNode).touched.value
					if (n.kind === 'form') return (n as any).isAnyTouched.value
					return false
				})
			})

			const isAnyDirtyRef = vueComputed(() => {
				return collectInputNodes(childNodes).some((n) => {
					if (n.kind === 'input') return (n as any).dirty?.value ?? false
					if (n.kind === 'form') return (n as any).isAnyDirty.value
					return false
				})
			})

			const isAnyTouchedNode: any = {
				kind: 'computed',
				get value() {
					return isAnyTouchedRef.value
				},
			}
			context.debug.registerNode(isAnyTouchedNode, {
				id: childPath(context.path, 'isAnyTouched'),
				path: childPath(context.path, 'isAnyTouched'),
				kind: 'computed',
				active: true,
			})
			Object.assign(isAnyTouchedNode, emptyDiagnosticsRefs)
			node.isAnyTouched = isAnyTouchedNode

			const isAnyDirtyNode: any = {
				kind: 'computed',
				get value() {
					return isAnyDirtyRef.value
				},
			}
			context.debug.registerNode(isAnyDirtyNode, {
				id: childPath(context.path, 'isAnyDirty'),
				path: childPath(context.path, 'isAnyDirty'),
				kind: 'computed',
				active: true,
			})
			Object.assign(isAnyDirtyNode, emptyDiagnosticsRefs)
			node.isAnyDirty = isAnyDirtyNode

			const formRef = { current: node }

			if (config.isSubmitting) {
				const getter = config.isSubmitting
				const ref = vueComputed(() =>
					context.debug.runWithReader(
						{
							readerId: childPath(context.path, 'isSubmitting'),
							reason: 'computed',
						},
						() => getter(context.debug.createSelfProxy(formRef.current)),
					),
				)
				const isSubmittingNode: any = {
					kind: 'computed',
					get value() {
						return ref.value
					},
				}
				context.debug.registerNode(isSubmittingNode, {
					id: childPath(context.path, 'isSubmitting'),
					path: childPath(context.path, 'isSubmitting'),
					kind: 'computed',
					active: true,
				})
				Object.assign(isSubmittingNode, emptyDiagnosticsRefs)
				node.isSubmitting = isSubmittingNode
			} else {
				node.isSubmitting = state(false).build({
					...context,
					path: childPath(context.path, 'isSubmitting'),
					registerNode: undefined,
				})
			}

			if (config.disabled) {
				const getter = config.disabled
				const ref = vueComputed(() =>
					context.debug.runWithReader(
						{
							readerId: childPath(context.path, 'disabled'),
							reason: 'computed',
						},
						() => getter(context.debug.createSelfProxy(formRef.current)),
					),
				)
				const disabledNode: any = {
					kind: 'computed',
					get value() {
						return ref.value
					},
				}
				context.debug.registerNode(disabledNode, {
					id: childPath(context.path, 'disabled'),
					path: childPath(context.path, 'disabled'),
					kind: 'computed',
					active: true,
				})
				Object.assign(disabledNode, emptyDiagnosticsRefs)
				node.disabled = disabledNode
			} else {
				node.disabled = state(false).build({
					...context,
					path: childPath(context.path, 'disabled'),
					registerNode: undefined,
				})
			}

			formRef.current = node

			const valueRef = vueComputed(() => {
				const result: Record<string, unknown> = {}
				for (const key of Object.keys(children)) {
					const child = resolveMaybeWhen(childNodes[key])
					if (child !== undefined) {
						result[key] = child.value
					}
				}
				return result
			})
			Object.defineProperty(node, 'value', {
				enumerable: true,
				configurable: true,
				get: () => valueRef.value,
			})

			const invalidReaderId = childPath(context.path, 'invalid')
			Object.assign(
				node,
				diagnosticsRefs(() => {
					context.debug.startReader({
						readerId: invalidReaderId,
						reason: 'computed',
					})
					try {
						return Object.keys(children).flatMap((key) => {
							const child = resolveMaybeWhen(childNodes[key])
							if (child?.__debug?.id) {
								context.debug.trackRead({
									targetId: child.__debug.id,
									targetProp: 'diagnostics',
								})
							}
							return nodeDiagnostics(child)
						})
					} finally {
						context.debug.endReader()
					}
				}),
			)

			return node as FormNode<TChildren>
		},
	}
}
