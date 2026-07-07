import { effectScope } from 'vue'
import type { DebugStore } from '../debug'
import { createDebugStore } from '../debug'
import { section } from '../nodes/section'
import { emptyDiagnosticsRefs } from '../nodes/utils'
import type { SectionChildren, TreeNode } from '../types'

export type DisplayTreeOptions<TPlugins extends Record<string, object>> = {
	plugins?: TPlugins
}

export type DisplayTree<
	TChildren extends SectionChildren,
	TPlugins extends Record<string, object>,
> = TreeNode<TChildren> & { plugins: TPlugins }

function isI18nPlugin(
	plugin: object,
): plugin is { t: { value: unknown }; locale: unknown } {
	return 't' in plugin && 'locale' in plugin
}

function withTrackedPlugins<TPlugins extends Record<string, object>>(
	plugins: TPlugins,
	debug: DebugStore,
): TPlugins {
	const result: any = {}
	for (const [key, plugin] of Object.entries(plugins)) {
		if (!isI18nPlugin(plugin)) {
			result[key] = plugin
			continue
		}

		const tNodeId = `plugins.${key}.t`
		const tNode: any = { kind: 'computed' }
		debug.registerNode(tNode, {
			id: tNodeId,
			path: tNodeId,
			kind: 'computed',
			label: `${key}.t`,
			active: true,
		})
		Object.assign(tNode, emptyDiagnosticsRefs)

		const originalT = plugin.t
		const trackedT = Object.create(originalT as object)
		Object.defineProperty(trackedT, 'value', {
			enumerable: true,
			get() {
				debug.trackRead({ targetId: tNodeId, targetProp: 'value' })
				return (originalT as any).value
			},
		})

		result[key] = { ...plugin, t: trackedT }
	}
	return result as TPlugins
}

export function createDisplayTree<
	TData,
	TChildren extends SectionChildren,
	TPlugins extends Record<string, object> = Record<never, never>,
>(
	dataTree: TData,
	factory: (plugins: TPlugins, data: TData) => TChildren,
	options?: DisplayTreeOptions<TPlugins>,
): DisplayTree<TChildren, TPlugins> {
	const plugins = (options?.plugins ?? {}) as TPlugins

	const displayDebug = createDebugStore()
	const root = {}

	displayDebug.registerNode(root as any, {
		id: 'root',
		path: 'root',
		kind: 'section',
		active: true,
	})

	const dataProxy = displayDebug.createSelfProxy(dataTree as any)

	const trackedPlugins = withTrackedPlugins(plugins, displayDebug)
	const children = factory(trackedPlugins, dataProxy)

	const context = {
		root,
		self: displayDebug.createSelfProxy(root as any),
		data: dataProxy,
		path: 'root',
		debug: displayDebug,
		registerNode: (node: any) => {
			Object.setPrototypeOf(root, node)
		},
	}

	const scope = effectScope(true)
	const tree = scope.run(() => section(children).build(context)) as DisplayTree<
		TChildren,
		TPlugins
	>

	Object.defineProperty(tree, 'dispose', {
		enumerable: false,
		configurable: false,
		value: () => scope.stop(),
	})

	Object.defineProperty(tree, 'debug', {
		enumerable: false,
		configurable: false,
		value: displayDebug,
	})

	Object.defineProperty(tree, 'plugins', {
		enumerable: false,
		configurable: false,
		value: plugins,
	})

	return tree
}
