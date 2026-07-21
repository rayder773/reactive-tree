import { data, readonlyData, type Data, type ReadonlyData } from '../data'

export interface LoadingState {
  status: 'idle' | 'loading' | 'error'
  error: unknown | null
}

const idle = (): LoadingState => ({ status: 'idle', error: null })

export class LoadingService<TKey> {
  readonly #states = new Map<TKey, Data<LoadingState>>()
  readonly #views = new Map<TKey, ReadonlyData<LoadingState>>()
  readonly #counts = new Map<TKey, Data<number>>()
  readonly #countViews = new Map<TKey, ReadonlyData<number>>()
  #disposed = false

  state(key: TKey): ReadonlyData<LoadingState> {
    let state = this.#states.get(key)
    if (!state) {
      state = data(idle())
      this.#states.set(key, state)
      this.#views.set(key, readonlyData(state))
    }
    return this.#views.get(key) as ReadonlyData<LoadingState>
  }

  activeCount(key: TKey): ReadonlyData<number> {
    if (!this.#counts.has(key)) {
      const count = data(0)
      this.#counts.set(key, count)
      this.#countViews.set(key, readonlyData(count))
    }
    return this.#countViews.get(key) as ReadonlyData<number>
  }

  async run<T>(key: TKey, operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.#disposed) throw new Error('LoadingService has been disposed')
    this.state(key)
    this.activeCount(key)
    const count = (this.#counts.get(key)?.get() ?? 0) + 1
    this.#counts.get(key)?.set(count)
    this.#states.get(key)?.set({ status: 'loading', error: null })
    try {
      return await operation()
    } catch (error) {
      if (!signal?.aborted) this.#states.get(key)?.set({ status: 'error', error })
      throw error
    } finally {
      const remaining = Math.max(0, (this.#counts.get(key)?.get() ?? 1) - 1)
      this.#counts.get(key)?.set(remaining)
      if (remaining === 0 && this.#states.get(key)?.get().status === 'loading') this.#states.get(key)?.set(idle())
    }
  }

  reset(key: TKey): void {
    this.#states.get(key)?.set(idle())
  }

  dispose(): void {
    this.#disposed = true
    this.#states.clear()
    this.#views.clear()
    this.#counts.clear()
    this.#countViews.clear()
  }
}
