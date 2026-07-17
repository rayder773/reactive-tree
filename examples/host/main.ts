import './style.css'
import { createHost } from './host'
import { applications } from './registry'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Host root element was not found')

const host = createHost(root, applications)
void host.start()

if (import.meta.hot) import.meta.hot.dispose(() => { void host.dispose() })
