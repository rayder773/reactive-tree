import { shallowRef } from 'vue'

export interface InspectEntry {
  descriptor: unknown
  badgeRect: DOMRect
  focusFn: () => void
  sourceLocation?: { file: string; line: number }
}

export const activeEntry = shallowRef<InspectEntry | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | null = null

export function showInspect(
  descriptor: unknown,
  badgeRect: DOMRect,
  focusFn: () => void,
  sourceLocation?: { file: string; line: number },
) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  activeEntry.value = { descriptor, badgeRect, focusFn, sourceLocation }
}

export function scheduleHide() {
  hideTimer = setTimeout(() => { activeEntry.value = null }, 150)
}

export function cancelHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}
