import { data, readonlyData, type Data, type ReadonlyData } from '../data'

export class FilteringService<TFilters extends object> {
  readonly #initial: TFilters
  readonly #state: Data<TFilters>
  readonly state: ReadonlyData<TFilters>

  constructor(initial: TFilters) {
    this.#initial = { ...initial }
    this.#state = data({ ...initial })
    this.state = readonlyData(this.#state)
  }

  set(value: TFilters): void { this.#state.set({ ...value }) }
  patch(value: Partial<TFilters>): void { this.#state.update((state) => ({ ...state, ...value })) }
  reset(): void { this.#state.set({ ...this.#initial }) }
}
