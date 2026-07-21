import type {
  ApplicationInstance,
  ApplicationRegistration,
  ApplicationRenderer,
  UiRegistration,
} from './app-contract'

export interface ExampleHost {
  start(): Promise<void>
  select(appId: string, uiId: string): Promise<void>
  dispose(): Promise<void>
}

export function createHost(
  root: HTMLElement,
  applications: readonly ApplicationRegistration[],
  uiLibraries: readonly UiRegistration[],
): ExampleHost {
  if (applications.length === 0) throw new Error('At least one application must be registered')
  if (uiLibraries.length === 0) throw new Error('At least one UI library must be registered')

  const applicationsById = new Map(applications.map((application) => [application.id, application]))
  root.innerHTML = `
    <div class="host-shell">
      <aside class="host-sidebar">
        <div class="brand">Reactive Tree</div>
        <nav class="host-nav" aria-label="Example options">
          <div class="host-nav-group" data-nav="apps">
            <div class="host-nav-label">Applications</div>
          </div>
          <div class="host-nav-group" data-nav="ui">
            <div class="host-nav-label">UI library</div>
          </div>
        </nav>
      </aside>
      <main class="host-main">
        <header><h1></h1><p></p></header>
        <section class="app-container" aria-live="polite"></section>
      </main>
    </div>`

  const appNavigation = root.querySelector<HTMLElement>('[data-nav="apps"]')!
  const uiNavigation = root.querySelector<HTMLElement>('[data-nav="ui"]')!
  const title = root.querySelector<HTMLElement>('h1')!
  const description = root.querySelector<HTMLElement>('header p')!
  const container = root.querySelector<HTMLElement>('.app-container')!
  let activeAppId: string | undefined
  let activeUiId: string | undefined
  let activeApplicationUiId: string | undefined
  let activeApplication: ApplicationInstance | undefined
  let activeRenderer: ApplicationRenderer | undefined
  let transition = 0
  let teardown = Promise.resolve()
  let disposed = false
  const disposedApplications = new Set<ApplicationInstance>()

  const disposeApplication = async (application: ApplicationInstance) => {
    if (disposedApplications.has(application)) return
    disposedApplications.add(application)
    await application.dispose()
  }

  const updateLocation = (appId: string, uiId: string, replace = false) => {
    const url = new URL(window.location.href)
    url.searchParams.set('app', appId)
    url.searchParams.set('ui', uiId)
    history[replace ? 'replaceState' : 'pushState']({}, '', url)
  }

  const currentSelection = () => {
    const url = new URL(window.location.href)
    return {
      appId: url.searchParams.get('app') ?? '',
      uiId: url.searchParams.get('ui') ?? '',
    }
  }

  for (const application of applications) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.appId = application.id
    button.textContent = application.title
    button.addEventListener('click', () => {
      const uiId = activeUiId ?? (currentSelection().uiId || uiLibraries[0].id)
      if (application.id === activeAppId) return
      updateLocation(application.id, uiId)
      void select(application.id, uiId)
    })
    appNavigation.append(button)
  }

  for (const ui of uiLibraries) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.uiId = ui.id
    button.textContent = ui.title
    button.addEventListener('click', () => {
      const appId = activeAppId ?? (currentSelection().appId || applications[0].id)
      if (ui.id === activeUiId) return
      updateLocation(appId, ui.id)
      void select(appId, ui.id)
    })
    uiNavigation.append(button)
  }

  const setActiveNavigation = (appId: string, uiId: string) => {
    for (const button of appNavigation.querySelectorAll('button')) {
      button.toggleAttribute('aria-current', (button as HTMLElement).dataset.appId === appId)
    }
    for (const button of uiNavigation.querySelectorAll('button')) {
      button.toggleAttribute('aria-current', (button as HTMLElement).dataset.uiId === uiId)
    }
  }

  const resolveSelection = (requestedAppId: string, requestedUiId: string) => {
    const application = applicationsById.get(requestedAppId) ?? applications[0]
    const supportedUi = uiLibraries.filter((ui) => application.id in ui.renderers)
    const ui = supportedUi.find((candidate) => candidate.id === requestedUiId) ?? supportedUi[0]
    if (!ui) throw new Error(`No UI renderer is registered for application "${application.id}"`)
    return { application, ui }
  }

  const select = async (requestedAppId: string, requestedUiId: string): Promise<void> => {
    if (disposed) return
    const selection = resolveSelection(requestedAppId, requestedUiId)
    const appId = selection.application.id
    const uiId = selection.ui.id
    if (requestedAppId !== appId || requestedUiId !== uiId) updateLocation(appId, uiId, true)
    if (appId === activeAppId && uiId === activeUiId && activeRenderer) return

    const token = ++transition
    const previousRenderer = activeRenderer
    activeRenderer = undefined
    activeUiId = undefined
    const changingApplication = appId !== activeAppId || uiId !== activeApplicationUiId || !activeApplication
    const previousApplication = changingApplication ? activeApplication : undefined
    if (changingApplication) {
      activeApplication = undefined
      activeAppId = undefined
      activeApplicationUiId = undefined
    }

    teardown = teardown.then(async () => {
      await previousRenderer?.unmount()
      if (previousApplication) await disposeApplication(previousApplication)
    })
    await teardown
    if (token !== transition || disposed) return

    title.textContent = selection.application.title
    description.textContent = selection.application.description
    setActiveNavigation(appId, uiId)
    container.innerHTML = '<div class="host-status">Loading…</div>'

    let renderer: ApplicationRenderer | undefined
    try {
      const createRenderer = await selection.ui.renderers[appId]()
      if (token !== transition || disposed) {
        return
      }
      // The UI factory installs its data adapter before the domain creates reactive values.
      renderer = createRenderer()
      let application = activeApplication
      if (!application) {
        application = selection.application.create()
        activeApplication = application
        activeAppId = appId
        activeApplicationUiId = uiId
      }
      container.innerHTML = ''
      await renderer.mount({ container, application })
      if (token !== transition || disposed) {
        await renderer.unmount()
        return
      }
      activeRenderer = renderer
      activeUiId = uiId
    } catch (error) {
      await renderer?.unmount()
      if (token !== transition || disposed) return
      const message = error instanceof Error ? error.message : String(error)
      container.innerHTML = ''
      const status = document.createElement('div')
      status.className = 'host-status host-error'
      status.textContent = `Unable to mount application: ${message}`
      container.append(status)
    }
  }

  const fromLocation = () => {
    const selection = currentSelection()
    return select(selection.appId, selection.uiId)
  }
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
      await activeRenderer?.unmount()
      if (activeApplication) await disposeApplication(activeApplication)
      activeRenderer = undefined
      activeApplication = undefined
      activeAppId = undefined
      activeUiId = undefined
      activeApplicationUiId = undefined
      root.innerHTML = ''
    },
  }
}
