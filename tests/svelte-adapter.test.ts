import { svelteDataAdapter } from '../adapters/svelte'
import { data, defaultDataAdapter, setDataAdapter } from '../core'

describe('Svelte data adapter', () => {
  it('exposes the current value and preserves core subscriptions', () => {
    setDataAdapter(svelteDataAdapter)
    const source = data(1)
    const values: number[] = []
    source.subscribe((value) => values.push(value))
    expect(source.value).toBe(1)
    source.set(2)
    expect(source.value).toBe(2)
    expect(values).toEqual([2])
    setDataAdapter(defaultDataAdapter)
  })
})
