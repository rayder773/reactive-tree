import type { Directive } from 'vue'
import { cancelHide, scheduleHide, showInspect } from './state'

interface InspectEl extends HTMLElement {
	__inspectDescriptor?: unknown
	__inspectBadge?: HTMLElement
	__inspectCleanup?: () => void
}

export const vInspect: Directive<InspectEl, unknown> = {
	mounted(el, binding) {
		setup(el, binding.value)
	},
	updated(el, binding) {
		el.__inspectDescriptor = binding.value
	},
	unmounted(el) {
		el.__inspectCleanup?.()
		el.__inspectBadge?.remove()
		delete el.__inspectBadge
		delete el.__inspectDescriptor
		delete el.__inspectCleanup
	},
}

function setup(el: InspectEl, descriptor: unknown) {
	el.__inspectDescriptor = descriptor

	const badge = document.createElement('div')
	badge.textContent = '◈'
	badge.style.cssText = [
		'position:fixed',
		'width:16px',
		'height:16px',
		'font-size:10px',
		'line-height:16px',
		'text-align:center',
		'background:#4a90d9',
		'color:#fff',
		'border-radius:3px',
		'cursor:pointer',
		'opacity:0',
		'transition:opacity 0.15s',
		'z-index:9000',
		'pointer-events:auto',
	].join(';')

	document.body.appendChild(badge)
	el.__inspectBadge = badge

	function updateBadgePos() {
		const rect = el.getBoundingClientRect()
		badge.style.top = rect.top + rect.height / 2 - 8 + 'px'
		badge.style.left = rect.right + 4 + 'px'
	}

	const onHostEnter = () => {
		updateBadgePos()
		badge.style.opacity = '1'
	}
	const onHostLeave = (e: MouseEvent) => {
		if (e.relatedTarget !== badge) badge.style.opacity = '0'
	}

	function focusFn() {
		const focusable = el.querySelector<HTMLElement>(
			'input, select, textarea, [tabindex]',
		)
		focusable?.focus()
	}

	const onBadgeEnter = () => {
		cancelHide()
		updateBadgePos()
		// __vueParentComponent is the renderer component (AppSelect.vue etc.)
		// .parent is the caller component (App.vue etc.) that wrote <AppSelect :node="..."/>
		// :__inspectSourceLine is injected by the Vite plugin onto <AppSelect> in App.vue
		const rendererInstance = (el as any).__vueParentComponent
		// vnode.ctx is the component that created this vnode (the slot provider / template owner),
		// which is correct even for components rendered inside a foreign slot.
		const file: string | undefined = rendererInstance?.vnode?.ctx?.type?.__file
		const sourceLine: number | undefined =
			rendererInstance?.vnode?.props?.['__inspectSourceLine']
		const sourceLocation = file ? { file, line: sourceLine ?? 1 } : undefined
		showInspect(
			el.__inspectDescriptor,
			badge.getBoundingClientRect(),
			focusFn,
			sourceLocation,
		)
	}
	const onBadgeLeave = () => {
		badge.style.opacity = '0'
		scheduleHide()
	}

	el.addEventListener('mouseenter', onHostEnter)
	el.addEventListener('mouseleave', onHostLeave)
	badge.addEventListener('mouseenter', onBadgeEnter)
	badge.addEventListener('mouseleave', onBadgeLeave)

	el.__inspectCleanup = () => {
		el.removeEventListener('mouseenter', onHostEnter)
		el.removeEventListener('mouseleave', onHostLeave)
		badge.removeEventListener('mouseenter', onBadgeEnter)
		badge.removeEventListener('mouseleave', onBadgeLeave)
	}
}
