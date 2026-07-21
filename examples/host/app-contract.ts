export interface ApplicationInstance {
  dispose(): void | Promise<void>
}

export interface ApplicationRenderer {
  mount(context: { container: HTMLElement; application: ApplicationInstance }): void | Promise<void>
  unmount(): void | Promise<void>
}

export type ApplicationRendererFactory = () => ApplicationRenderer

export interface ApplicationRegistration {
  id: string
  title: string
  description: string
  create(): ApplicationInstance
}

export interface UiRegistration {
  id: string
  title: string
  renderers: Readonly<Record<string, () => Promise<ApplicationRendererFactory>>>
}
