import { effect, stop } from 'vue'
import { vueDataAdapter } from '../adapters/vue'
import { data, defaultDataAdapter, readonlyData, setDataAdapter } from '../core'

describe('Vue data adapter', () => {
  it('tracks get() directly when Vue is selected as the data implementation', () => {
    setDataAdapter(vueDataAdapter)
    const source = data(1)
    const view = readonlyData(source)
    const values: number[] = []
    const runner = effect(() => values.push(view.get()))
    source.set(2)
    stop(runner)
    source.set(3)
    expect(values).toEqual([1, 2])
    setDataAdapter(defaultDataAdapter)
  })
})
