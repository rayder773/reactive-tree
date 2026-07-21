import { mount, unmount } from 'svelte'
import { svelteDataAdapter } from '../../../../adapters/svelte'
import { setDataAdapter } from '../../../../core'
import type { CounterController } from '../../../apps/counter/domain'
import type { ApplicationRenderer } from '../../../host/app-contract'
import '../../shared/counter.css'
import App from './App.svelte'

export function createRenderer(): ApplicationRenderer {
  setDataAdapter(svelteDataAdapter)
  let instance: ReturnType<typeof mount> | undefined
  return {
    mount({ container, application }) {
      if (instance) return
      instance = mount(App, {
        target: container,
        props: { controller: application as CounterController },
      })
    },
    async unmount() {
      if (!instance) return
      const mountedInstance = instance
      instance = undefined
      await unmount(mountedInstance)
    },
  }
}
