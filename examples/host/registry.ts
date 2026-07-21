import { createCounterController } from '../apps/counter/domain'
import { createPartsDomain } from '../apps/parts-list/parts-domain'
import type { ApplicationRegistration, UiRegistration } from './app-contract'

export const applications: readonly ApplicationRegistration[] = [
  {
    id: 'parts-list',
    title: 'Parts list',
    description: 'Two reactive views over one normalized entity dictionary.',
    create: createPartsDomain,
  },
  {
    id: 'counter',
    title: 'Counter',
    description: 'A small framework-neutral reactive controller.',
    create: createCounterController,
  },
]

export const uiLibraries: readonly UiRegistration[] = [
  {
    id: 'vue',
    title: 'Vue',
    renderers: {
      'parts-list': async () => (await import('../ui/vue/parts-list/entry')).createRenderer,
      counter: async () => (await import('../ui/vue/counter/entry')).createRenderer,
    },
  },
  {
    id: 'react',
    title: 'React',
    renderers: {
      'parts-list': async () => (await import('../ui/react/parts-list/entry')).createRenderer,
      counter: async () => (await import('../ui/react/counter/entry')).createRenderer,
    },
  },
  {
    id: 'svelte',
    title: 'Svelte',
    renderers: {
      'parts-list': async () => (await import('../ui/svelte/parts-list/entry')).createRenderer,
      counter: async () => (await import('../ui/svelte/counter/entry')).createRenderer,
    },
  },
]
