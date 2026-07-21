import { mount, unmount } from 'svelte'
import { svelteDataAdapter } from '../../../../adapters/svelte'
import { setDataAdapter } from '../../../../core'
import type { PartsDomain } from '../../../apps/parts-list/parts-domain'
import type { ApplicationRenderer } from '../../../host/app-contract'
import '../../shared/parts-list.css'
import App from './App.svelte'

export function createRenderer(): ApplicationRenderer {
  setDataAdapter(svelteDataAdapter)
  let instance: ReturnType<typeof mount> | undefined
  return {
    mount({ container, application }) {
      if (instance) return
      instance = mount(App, {
        target: container,
        props: { domain: application as PartsDomain },
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
