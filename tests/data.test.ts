import { data, readonlyData } from '../core'

describe('data', () => {
  it('reads, sets, updates and skips Object.is-equal values', () => {
    const value = data(1)
    const calls: unknown[] = []
    value.subscribe((next, previous) => calls.push([next, previous]))
    value.set(1)
    value.update((current) => current + 1)
    expect(value.get()).toBe(2)
    expect(calls).toEqual([[2, 1]])
  })

  it('uses a subscriber snapshot and idempotent unsubscription', () => {
    const value = data(0)
    const calls: string[] = []
    let unsubscribeSecond = () => {}
    value.subscribe(() => { calls.push('first'); unsubscribeSecond() })
    unsubscribeSecond = value.subscribe(() => calls.push('second'))
    value.set(1)
    value.set(2)
    unsubscribeSecond()
    expect(calls).toEqual(['first', 'second', 'first'])
  })

  it('returns a separate readonly facade', () => {
    const mutable = data('a')
    const view = readonlyData(mutable)
    expect(view).not.toBe(mutable)
    expect('set' in view).toBe(false)
    mutable.set('b')
    expect(view.get()).toBe('b')
  })
})
