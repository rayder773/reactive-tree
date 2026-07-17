import { createApp, type App as VueApp } from 'vue'
import { vueDataAdapter } from '../../../adapters/vue'
import type { MountedApplication } from '../../host/app-contract'
import App from './App.vue'
import { createCounterController } from './domain'

export function createApplication(): MountedApplication {
  let app: VueApp<Element> | undefined
  return {
    mount({ container }) {
      if (app) return
      const controller = createCounterController(vueDataAdapter)
      app = createApp(App, { controller })
      app.mount(container)
    },
    unmount() {
      app?.unmount()
      app = undefined
    },
  }
}
