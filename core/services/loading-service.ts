import { data, defaultDataAdapter, readonlyData, type Data, type DataAdapter, type ReadonlyData } from '../data'

export interface LoadingState {
  status: 'idle' | 'loading' | 'error'
  error: unknown | null
}

const idle = (): LoadingState => ({ status: 'idle', error: null })

export class LoadingService<TKey> {
  readonly #dataAdapter: DataAdapter
  readonly #states = new Map<TKey, Data<LoadingState>>()
  readonly #views = new Map<TKey, ReadonlyData<LoadingState>>()
  readonly #generations = new Map<TKey, number>()
  #disposed = false

  constructor(dataAdapter: DataAdapter = defaultDataAdapter) {
    this.#dataAdapter = dataAdapter
  }

  state(key: TKey): ReadonlyData<LoadingState> {
    let state = this.#states.get(key)
    if (!state) {
      state = data(idle(), this.#dataAdapter)
      this.#states.set(key, state)
      this.#views.set(key, readonlyData(state))
    }
    return this.#views.get(key) as ReadonlyData<LoadingState>
  }

  async run<T>(key: TKey, operation: () => Promise<T>): Promise<T> {
    if (this.#disposed) throw new Error('LoadingService has been disposed')
    const generation = (this.#generations.get(key) ?? 0) + 1
    this.#generations.set(key, generation)
    this.state(key)
    this.#states.get(key)?.set({ status: 'loading', error: null })
    try {
      const result = await operation()
      if (this.#generations.get(key) === generation) {
        this.#states.get(key)?.set(idle())
      }
      return result
    } catch (error) {
      if (this.#generations.get(key) === generation) {
        this.#states.get(key)?.set({ status: 'error', error })
      }
      throw error
    }
  }

  reset(key: TKey): void {
    this.#generations.set(key, (this.#generations.get(key) ?? 0) + 1)
    this.#states.get(key)?.set(idle())
  }

  dispose(): void {
    this.#disposed = true
    this.#generations.clear()
    this.#states.clear()
    this.#views.clear()
  }
}
