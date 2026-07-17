import type { ApplicationRegistration, MountedApplication } from './app-contract'

export interface ExampleHost {
  start(): Promise<void>
  select(id: string): Promise<void>
  dispose(): Promise<void>
}

export function createHost(root: HTMLElement, registrations: readonly ApplicationRegistration[]): ExampleHost {
  if (registrations.length === 0) throw new Error('At least one application must be registered')
  const byId = new Map(registrations.map((registration) => [registration.id, registration]))
  root.innerHTML = `
    <div class="host-shell">
      <aside class="host-sidebar">
        <div class="brand">Reactive Tree</div>
        <nav aria-label="Examples"></nav>
      </aside>
      <main class="host-main">
        <header><h1></h1><p></p></header>
        <section class="app-container" aria-live="polite"></section>
      </main>
    </div>`
  const nav = root.querySelector('nav') as HTMLElement
  const title = root.querySelector('h1') as HTMLElement
  const description = root.querySelector('header p') as HTMLElement
  const container = root.querySelector('.app-container') as HTMLElement
  let activeId: string | undefined
  let activeApplication: MountedApplication | undefined
  let transition = 0
  let teardown = Promise.resolve()
  let disposed = false

  for (const registration of registrations) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.appId = registration.id
    button.textContent = registration.title
    button.addEventListener('click', () => {
      if (registration.id === activeId) return
      const url = new URL(window.location.href)
      url.searchParams.set('app', registration.id)
      history.pushState({}, '', url)
      void select(registration.id)
    })
    nav.append(button)
  }

  const setActiveNavigation = (id: string) => {
    for (const button of nav.querySelectorAll('button')) {
      button.toggleAttribute('aria-current', (button as HTMLElement).dataset.appId === id)
    }
  }

  const select = async (requestedId: string): Promise<void> => {
    if (disposed) return
    const registration = byId.get(requestedId) ?? registrations[0]
    const id = registration.id
    if (!byId.has(requestedId)) {
      const url = new URL(window.location.href)
      url.searchParams.set('app', id)
      history.replaceState({}, '', url)
    }
    if (id === activeId) return
    const token = ++transition
    const previous = activeApplication
    activeApplication = undefined
    activeId = undefined
    if (previous) teardown = teardown.then(() => previous.unmount())
    await teardown
    if (token !== transition || disposed) return
    title.textContent = registration.title
    description.textContent = registration.description
    setActiveNavigation(id)
    container.innerHTML = '<div class="host-status">Loading…</div>'
    let next: MountedApplication | undefined
    try {
      next = await registration.load()
      if (token !== transition || disposed) {
        await next.unmount()
        return
      }
      container.innerHTML = ''
      await next.mount({ container })
      if (token !== transition || disposed) {
        await next.unmount()
        return
      }
      activeApplication = next
      activeId = id
    } catch (error) {
      await next?.unmount()
      if (token !== transition || disposed) return
      const message = error instanceof Error ? error.message : String(error)
      container.innerHTML = ''
      const status = document.createElement('div')
      status.className = 'host-status host-error'
      status.textContent = `Unable to mount application: ${message}`
      container.append(status)
    }
  }

  const fromLocation = () => select(new URL(window.location.href).searchParams.get('app') ?? '')
  const onPopState = () => { void fromLocation() }

  return {
    async start() {
      window.addEventListener('popstate', onPopState)
      await fromLocation()
    },
    select,
    async dispose() {
      if (disposed) return
      disposed = true
      transition++
      window.removeEventListener('popstate', onPopState)
      await teardown
      await activeApplication?.unmount()
      activeApplication = undefined
      activeId = undefined
      root.innerHTML = ''
    },
  }
}
