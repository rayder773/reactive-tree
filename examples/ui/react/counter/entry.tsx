import { createRoot, type Root } from 'react-dom/client'
import { ReactDataRoot, reactDataAdapter } from '../../../../adapters/react'
import { setDataAdapter } from '../../../../core'
import type { CounterController } from '../../../apps/counter/domain'
import type { ApplicationRenderer } from '../../../host/app-contract'
import '../../shared/counter.css'
import { App } from './App'

export function createRenderer(): ApplicationRenderer {
  setDataAdapter(reactDataAdapter)
  let root: Root | undefined
  return {
    mount({ container, application }) {
      if (root) return
      root = createRoot(container)
      root.render(
        <ReactDataRoot render={() => <App controller={application as CounterController} />} />,
      )
    },
    unmount() {
      root?.unmount()
      root = undefined
    },
  }
}
