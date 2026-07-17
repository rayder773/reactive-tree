import { createApp, type App as VueApp } from 'vue'
import { vueDataAdapter } from '../../../adapters/vue'
import type { MountedApplication } from '../../host/app-contract'
import App from './App.vue'
import { createPartsDomain, type PartsDomain } from './parts-domain'

export function createApplication(): MountedApplication {
  let app: VueApp<Element> | undefined
  let domain: PartsDomain | undefined
  return {
    mount({ container }) {
      if (app) return
      domain = createPartsDomain(vueDataAdapter)
      app = createApp(App, { domain })
      app.mount(container)
    },
    unmount() {
      app?.unmount()
      domain?.dispose()
      app = undefined
      domain = undefined
    },
  }
}
