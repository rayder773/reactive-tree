import { computed as vueComputed } from 'vue'
import {
	childPath,
	emptyDiagnosticsRefs,
	registerDebugNode,
} from '../nodes/utils'
import type { ActionNode, AnyNode, BuildContext, NodeSpec } from '../types'
import type { DomBinding } from './domBinding'

export type ButtonGetter<T, TRoot = any> = (root: TRoot) => T

export interface ButtonConfig<TRoot = any> {
	disabled?: ButtonGetter<boolean, TRoot>
	display?: ButtonGetter<boolean, TRoot>
	text?: string | (() => string)
	handlers?: Record<string, ActionNode>
}

export interface ButtonNode extends AnyNode {
	readonly kind: 'button'
	readonly disabled: { value: boolean }
	readonly display: { value: boolean }
	readonly text: string | undefined
	readonly textReactive: boolean
	readonly domProp: 'textContent'
	readonly handlers: Record<string, ActionNode>
}

function buildComputedChild(
	context: BuildContext,
	key: string,
	getter: ButtonGetter<boolean> | undefined,
	fallback: boolean,
): { value: boolean } {
	if (getter) {
		const path = childPath(context.path, key)
		const ref = vueComputed(() =>
			context.debug.runWithReader({ readerId: path, reason: 'computed' }, () =>
				getter(context.self),
			),
		)
		const node: any = {
			kind: 'computed',
			get value() {
				return ref.value
			},
		}
		context.debug.registerNode(node, {
			id: path,
			path,
			kind: 'computed',
			active: true,
		})
		Object.assign(node, emptyDiagnosticsRefs)
		return node
	}

	const node: any = {
		kind: 'computed',
		get value() {
			return fallback
		},
	}
	Object.assign(node, emptyDiagnosticsRefs)
	return node
}

export function button<TRoot = any>(
	config: ButtonConfig<TRoot> = {},
): NodeSpec<ButtonNode> {
	return {
		build(context: BuildContext): ButtonNode {
			const node: any = {
				kind: 'button' as const,
				domProp: 'textContent' as const,
				handlers: config.handlers ?? {},
			}

			let textReaderNodeId: string | undefined
			if (typeof config.text === 'function') {
				const textGetter = config.text
				const path = childPath(context.path, 'text')
				textReaderNodeId = path
				const textRef = vueComputed(() =>
					context.debug.runWithReader(
						{ readerId: path, reason: 'computed' },
						() => textGetter(),
					),
				)
				Object.defineProperty(node, 'text', {
					get() {
						return textRef.value
					},
					enumerable: true,
				})
				node.textReactive = true
				const i18nSource =
					(config.text as any).__textSource ?? (config.text as any).__i18nSource
				if (i18nSource) node.i18nSourceLocation = i18nSource
			} else {
				node.text = config.text
				node.textReactive = false
			}

			Object.defineProperty(node, '__displayDebug', {
				value: context.debug,
				enumerable: false,
			})

			registerDebugNode(context, node, 'button', true, (config as any).__source)
			Object.assign(node, emptyDiagnosticsRefs)

			node.disabled = buildComputedChild(
				context,
				'disabled',
				config.disabled as ButtonGetter<boolean>,
				false,
			)
			node.display = buildComputedChild(
				context,
				'display',
				config.display as ButtonGetter<boolean>,
				true,
			)

			const textNode = {
				get value() {
					return node.text ?? 'Submit'
				},
			}
			const domBindings: DomBinding[] = [
				{
					prop: 'textContent',
					sourceNode: textNode,
					readerNodeId: textReaderNodeId,
					tag: node.textReactive ? 'i18n' : null,
					editable: false,
					sourceLocation: node.textReactive
						? (node as any).i18nSourceLocation
						: undefined,
				},
				{
					prop: 'disabled',
					sourceNode: node.disabled,
					readerNodeId: (node.disabled as any)?.__debug?.id,
					tag: 'display',
					editable: false,
					sourceLocation: (node.disabled as any)?.__debug?.sourceLocation,
				},
			]
			Object.defineProperty(node, '__domBindings', {
				enumerable: false,
				value: domBindings,
			})

			context.registerNode?.(node)

			return node as ButtonNode
		},
	}
}
