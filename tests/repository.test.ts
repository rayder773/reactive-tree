import { ApiError, createRepository, createScenario, error, loading, networkError, success } from '../core'

interface TestRepository {
  get(id: string, signal: AbortSignal): Promise<{ id: string }>
  list(limit: number, signal: AbortSignal): Promise<readonly string[]>
}

describe('repository scenarios', () => {
  it('selects repository-specific, global, and fallback scenarios', () => {
    const real = { value: 'real' }
    const happy = { value: 'happy' }
    const empty = { value: 'empty' }
    vi.stubEnv('VITE_MOCK', 'true')
    vi.stubEnv('VITE_SCENARIO', 'empty')
    vi.stubEnv('VITE_TEST_SCENARIO', 'missing')
    expect(createRepository(() => real, { 'happy-path': happy, empty }, 'VITE_TEST_SCENARIO')).toBe(happy)
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_MOCK', 'true')
    vi.stubEnv('VITE_SCENARIO', 'empty')
    expect(createRepository(() => real, { 'happy-path': happy, empty }, 'VITE_TEST_SCENARIO')).toBe(empty)
    vi.stubEnv('VITE_MOCK', 'false')
    expect(createRepository(() => real, { 'happy-path': happy, empty })).toBe(real)
    vi.unstubAllEnvs()
  })

  it('resolves typed handlers without forwarding AbortSignal', async () => {
    const repository = createScenario<TestRepository>()
      .on('get', (id) => success({ id }))
      .on('list', (limit) => success(Array.from({ length: limit }, (_, index) => String(index))))
      .build()
    expect(await repository.get('x', new AbortController().signal)).toEqual({ id: 'x' })
    expect(await repository.list(2, new AbortController().signal)).toEqual(['0', '1'])
  })

  it('supports API, network and infinite-loading outcomes', async () => {
    const failed = createScenario<TestRepository>()
      .on('get', error(404, { code: 'NOT_FOUND' }))
      .on('list', networkError())
      .build()
    await expect(failed.get('x', new AbortController().signal)).rejects.toMatchObject<ApiError>({ status: 404 })
    await expect(failed.list(1, new AbortController().signal)).rejects.toMatchObject<ApiError>({ status: 0 })

    const pending = createScenario<TestRepository>()
      .on('get', loading())
      .on('list', success([]))
      .build()
    const controller = new AbortController()
    const promise = pending.get('x', controller.signal)
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('requires every repository method at compile time', () => {
    const incomplete = createScenario<TestRepository>().on('get', success({ id: 'x' }))
    // @ts-expect-error list is not configured
    incomplete.build()
  })
})
