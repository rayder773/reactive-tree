// @vitest-environment happy-dom

import { createHost } from '../examples/host/host'
import type {
  ApplicationInstance,
  ApplicationRegistration,
  ApplicationRendererFactory,
  UiRegistration,
} from '../examples/host/app-contract'

describe('example host', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    history.replaceState({}, '', 'http://localhost/')
  })

  const application = (id: string, events: string[]): ApplicationRegistration => ({
    id,
    title: id,
    description: `${id} description`,
    create() {
      events.push(`create:${id}`)
      return { dispose: () => { events.push(`dispose:${id}`) } }
    },
  })

  const ui = (id: string, appIds: string[], events: string[]): UiRegistration => ({
    id,
    title: id,
    renderers: Object.fromEntries(appIds.map((appId) => [appId, async (): Promise<ApplicationRendererFactory> => () => ({
      mount: () => { events.push(`mount:${appId}:${id}`) },
      unmount: () => { events.push(`unmount:${appId}:${id}`) },
    })])),
  })

  it('selects app and UI independently and recreates the domain for a new UI adapter', async () => {
    const events: string[] = []
    const applications = [application('one', events), application('two', events)]
    const uiLibraries = [ui('vue', ['one', 'two'], events), ui('react', ['one', 'two'], events)]
    const host = createHost(document.querySelector<HTMLElement>('#root')!, applications, uiLibraries)

    await host.start()
    expect(location.search).toBe('?app=one&ui=vue')
    await host.select('one', 'react')
    expect(events).toEqual([
      'create:one',
      'mount:one:vue',
      'unmount:one:vue',
      'dispose:one',
      'create:one',
      'mount:one:react',
    ])
    await host.select('two', 'react')
    expect(events.slice(-4)).toEqual([
      'unmount:one:react',
      'dispose:one',
      'create:two',
      'mount:two:react',
    ])
    await host.dispose()
    expect(events.slice(-2)).toEqual(['unmount:two:react', 'dispose:two'])
  })

  it('normalizes unsupported app and UI values in the URL', async () => {
    const events: string[] = []
    history.replaceState({}, '', 'http://localhost/?app=missing&ui=missing')
    const host = createHost(
      document.querySelector<HTMLElement>('#root')!,
      [application('one', events)],
      [ui('vue', ['one'], events)],
    )
    await host.start()
    expect(location.search).toBe('?app=one&ui=vue')
  })

  it('ignores stale lazy renderer factories before they install an adapter', async () => {
    let release!: () => void
    const slow = new Promise<void>((resolve) => { release = resolve })
    const events: string[] = []
    const slowUi: UiRegistration = {
      id: 'vue',
      title: 'Vue',
      renderers: {
        slow: async () => {
          await slow
          return () => ({
            mount: () => { events.push('slow mount') },
            unmount: () => { events.push('slow cleanup') },
          })
        },
        fast: async () => () => ({
          mount: () => { events.push('fast mount') },
          unmount: () => { events.push('fast cleanup') },
        }),
      },
    }
    const host = createHost(
      document.querySelector<HTMLElement>('#root')!,
      [application('slow', events), application('fast', events)],
      [slowUi],
    )
    const starting = host.start()
    await host.select('fast', 'vue')
    release()
    await starting
    expect(events).toContain('fast mount')
    expect(events).not.toContain('slow mount')
    expect(events).not.toContain('slow cleanup')
    expect(events).not.toContain('create:slow')
  })

  it('shows a framework-neutral error and cleans up after a mount failure', async () => {
    const events: string[] = []
    const brokenUi: UiRegistration = {
      id: 'broken-ui',
      title: 'Broken UI',
      renderers: {
        broken: async () => () => ({
          mount: () => { events.push('mount'); throw new Error('broken mount') },
          unmount: () => { events.push('cleanup') },
        }),
      },
    }
    const brokenApplication: ApplicationRegistration = {
      id: 'broken',
      title: 'Broken',
      description: 'Failure example',
      create: (): ApplicationInstance => ({ dispose: () => { events.push('dispose') } }),
    }
    const host = createHost(
      document.querySelector<HTMLElement>('#root')!,
      [brokenApplication],
      [brokenUi],
    )
    await host.start()
    expect(events).toEqual(['mount', 'cleanup'])
    expect(document.querySelector('.host-error')?.textContent).toContain('broken mount')
    await host.dispose()
    expect(events.at(-1)).toBe('dispose')
  })
})
