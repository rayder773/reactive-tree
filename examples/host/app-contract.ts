export interface MountedApplication {
  mount(context: { container: HTMLElement }): void | Promise<void>
  unmount(): void | Promise<void>
}

export interface ApplicationRegistration {
  id: string
  title: string
  description: string
  load(): Promise<MountedApplication>
}
