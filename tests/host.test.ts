// @vitest-environment happy-dom

import { createHost } from '../examples/host/host'
import type { ApplicationRegistration } from '../examples/host/app-contract'

describe('example host', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    history.replaceState({}, '', 'http://localhost/')
  })

  it('loads lazily, fixes invalid URLs, and unmounts before mounting the next app', async () => {
    const events: string[] = []
    const registration = (id: string): ApplicationRegistration => ({
      id, title: id, description: `${id} description`,
      async load() { events.push(`load:${id}`); return { mount: () => { events.push(`mount:${id}`) }, unmount: () => { events.push(`unmount:${id}`) } } },
    })
    const host = createHost(document.querySelector<HTMLElement>('#root')!, [registration('one'), registration('two')])
    await host.start()
    expect(location.search).toBe('?app=one')
    await host.select('two')
    expect(events).toEqual(['load:one', 'mount:one', 'unmount:one', 'load:two', 'mount:two'])
    await host.dispose()
    expect(events.at(-1)).toBe('unmount:two')
  })

  it('cleans up a failed mount and ignores stale lazy transitions', async () => {
    let release!: () => void
    const slow = new Promise<void>((resolve) => { release = resolve })
    const events: string[] = []
    const registrations: ApplicationRegistration[] = [
      { id: 'slow', title: 'Slow', description: '', load: async () => { await slow; return { mount: () => events.push('slow mount'), unmount: () => events.push('slow cleanup') } } },
      { id: 'fast', title: 'Fast', description: '', load: async () => ({ mount: () => events.push('fast mount'), unmount: () => events.push('fast cleanup') }) },
    ]
    const host = createHost(document.querySelector<HTMLElement>('#root')!, registrations)
    const starting = host.start()
    await host.select('fast')
    release()
    await starting
    expect(events).toContain('fast mount')
    expect(events).not.toContain('slow mount')
    expect(events).toContain('slow cleanup')
  })

  it('shows a framework-neutral error and cleans up after a mount failure', async () => {
    const events: string[] = []
    const host = createHost(document.querySelector<HTMLElement>('#root')!, [{
      id: 'broken', title: 'Broken', description: 'Failure example',
      load: async () => ({
        mount: () => { events.push('mount'); throw new Error('broken mount') },
        unmount: () => { events.push('cleanup') },
      }),
    }])
    await host.start()
    expect(events).toEqual(['mount', 'cleanup'])
    expect(document.querySelector('.host-error')?.textContent).toContain('broken mount')
  })
})
