import { type Ref, ref, watchEffect } from 'vue'
import { normalizeCheckResult } from '../checks/check'
import type {
	ActionNode,
	BuildContext,
	NodeOptions,
	NodeSpec,
	StateActions,
	StateNode,
} from '../types'
import {
	activeChecks,
	diagnosticsFor,
	diagnosticsRefs,
	registerDebugNode,
} from './utils'

export function state<T>(
	initialValue: T,
	options: NodeOptions<T> = {},
): NodeSpec<StateNode<T>> {
	return {
		build(context: BuildContext) {
			const value = ref(initialValue) as Ref<T>
			const checks = activeChecks(options)

			const node = {
				kind: 'state' as const,
				id: options.id,
				label: options.label,
				metadata: options.metadata,
				checks,
				get value() {
					return value.value
				},
				set(nextValue: T) {
					for (const item of checks) {
						if (item.mode !== 'block') {
							continue
						}

						const result = normalizeCheckResult(
							item.run(nextValue, { root: context.root, node, phase: 'set' }),
						)

						if (result.block || result.diagnostic) {
							return false
						}
					}

					value.value = nextValue
					return true
				},
				reset() {
					value.value = initialValue
				},
			} as unknown as StateNode<T>

			registerDebugNode(context, node, 'state', true, (options as any).__source)

			Object.assign(
				node,
				diagnosticsRefs(() =>
					diagnosticsFor(checks, value.value, context, node),
				),
			)

			context.registerNode?.(node)

			return node
		},
	}
}

export function withWatch<TNode extends StateNode<any>>(
	stateSpec: NodeSpec<TNode>,
	getters: Array<(root: any) => TNode['value'] | null | undefined>,
): NodeSpec<TNode> {
	return {
		build(context: BuildContext): TNode {
			const node = stateSpec.build(context)
			const startWatching = () => {
				for (const getter of getters) {
					watchEffect(() => {
						const val = context.debug.runWithReader(
							{ readerId: node.__debug.id, reason: 'watch' },
							() => getter(context.self),
						)
						if (val != null) {
							node.set(val)
						}
					})
				}
			}
			if (context.defer) {
				context.defer(startWatching)
			} else {
				startWatching()
			}
			return node
		},
	}
}

export function withActions<T, TActions extends StateActions<T>>(
	stateSpec: NodeSpec<StateNode<T>>,
	actions: TActions,
): NodeSpec<StateNode<T, TActions>> {
	return {
		build(context: BuildContext): StateNode<T, TActions> {
			const node = stateSpec.build(context) as StateNode<T, TActions>

			for (const [name, fn] of Object.entries(actions)) {
				const actionNode: ActionNode = {
					kind: 'action',
					name,
					ownerPath: context.path,
					ownerLabel: node.label,
					call: () => fn(node),
				}
				;(node as any)[name] = actionNode
			}

			return node
		},
	}
}
