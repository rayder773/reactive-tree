// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactDataRoot, reactDataAdapter } from '../adapters/react'
import { data, defaultDataAdapter, setDataAdapter } from '../core'

describe('React data adapter', () => {
  it('rerenders its root when a data value changes', async () => {
    setDataAdapter(reactDataAdapter)
    const source = data(1)
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<ReactDataRoot render={() => <span>{source.value}</span>} />)
    })
    expect(container.textContent).toBe('1')
    await act(async () => source.set(2))
    expect(container.textContent).toBe('2')
    await act(async () => root.unmount())
    setDataAdapter(defaultDataAdapter)
  })
})
