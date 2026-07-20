import { createApp, type App as VueApp } from 'vue'
import { vueDataAdapter } from '../../../adapters/vue'
import { setDataAdapter } from '../../../core'
import type { MountedApplication } from '../../host/app-contract'
import App from './App.vue'
import { createCounterController } from './domain'

export function createApplication(): MountedApplication {
  let app: VueApp<Element> | undefined
  return {
    mount({ container }) {
      if (app) return
      setDataAdapter(vueDataAdapter)
      const controller = createCounterController()
      app = createApp(App, { controller })
      app.mount(container)
    },
    unmount() {
      app?.unmount()
      app = undefined
    },
  }
}
