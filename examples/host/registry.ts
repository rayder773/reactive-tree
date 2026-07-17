import type { ApplicationRegistration } from './app-contract'

export const applications: readonly ApplicationRegistration[] = [
  {
    id: 'parts-list',
    title: 'Parts list',
    description: 'Two reactive views over one normalized entity dictionary.',
    load: async () => (await import('../apps/parts-list/entry')).createApplication(),
  },
  {
    id: 'counter',
    title: 'Counter',
    description: 'A small framework-neutral controller mounted through Vue.',
    load: async () => (await import('../apps/counter/entry')).createApplication(),
  },
]
