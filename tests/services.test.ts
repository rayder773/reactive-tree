import { AbortService, FilteringService, LoadingService, PaginationService, SortingService } from '../core'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('independent services', () => {
  it('tracks loading success, error, and only lets the latest request own state', async () => {
    const loading = new LoadingService<string>()
    const first = deferred<number>()
    const second = deferred<number>()
    const a = loading.run('key', () => first.promise)
    const b = loading.run('key', () => second.promise)
    first.reject(new Error('old'))
    await expect(a).rejects.toThrow('old')
    expect(loading.state('key').get().status).toBe('loading')
    second.resolve(2)
    await expect(b).resolves.toBe(2)
    expect(loading.state('key').get()).toEqual({ status: 'idle', error: null })
  })

  it('aborts the previous transport for a key', async () => {
    const abort = new AbortService<string>()
    let firstSignal: AbortSignal | undefined
    void abort.run('key', async (signal) => { firstSignal = signal; return 1 })
    await abort.run('key', async () => 2)
    expect(firstSignal?.aborted).toBe(true)
  })

  it('owns readonly sorting and filtering state and resets it', () => {
    const sorting = new SortingService({ field: 'name', direction: 'asc' as const })
    sorting.setDirection('desc')
    sorting.reset()
    expect(sorting.state.get()).toEqual({ field: 'name', direction: 'asc' })
    const filtering = new FilteringService({ search: '' })
    filtering.patch({ search: 'belt' })
    filtering.reset()
    expect(filtering.state.get()).toEqual({ search: '' })
    expect('set' in filtering.state).toBe(false)
  })

  it('validates and updates pagination', () => {
    const pagination = new PaginationService({ pageSize: 10 })
    pagination.setPage(2)
    pagination.setTotal(25)
    expect(pagination.state.get()).toEqual({ page: 2, pageSize: 10, total: 25 })
    expect(() => pagination.setPage(0)).toThrow(RangeError)
    expect(() => pagination.setPageSize(1.5)).toThrow(RangeError)
  })
})
