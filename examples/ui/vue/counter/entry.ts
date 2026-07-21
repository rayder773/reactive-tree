import { createApp, type App as VueApp } from 'vue'
import { vueDataAdapter } from '../../../../adapters/vue'
import { setDataAdapter } from '../../../../core'
import type { CounterController } from '../../../apps/counter/domain'
import type { ApplicationRenderer } from '../../../host/app-contract'
import '../../shared/counter.css'
import App from './App.vue'

export function createRenderer(): ApplicationRenderer {
  setDataAdapter(vueDataAdapter)
  let app: VueApp<Element> | undefined
  return {
    mount({ container, application }) {
      if (app) return
      app = createApp(App, { controller: application as CounterController })
      app.mount(container)
    },
    unmount() {
      app?.unmount()
      app = undefined
    },
  }
}
