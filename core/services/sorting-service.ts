import { data, defaultDataAdapter, readonlyData, type Data, type DataAdapter, type ReadonlyData } from '../data'

export type SortDirection = 'asc' | 'desc'
export interface SortingState<TField> { field: TField; direction: SortDirection }

export class SortingService<TField> {
  readonly #initial: SortingState<TField>
  readonly #state: Data<SortingState<TField>>
  readonly state: ReadonlyData<SortingState<TField>>

  constructor(initial: SortingState<TField>, dataAdapter: DataAdapter = defaultDataAdapter) {
    this.#initial = { ...initial }
    this.#state = data({ ...initial }, dataAdapter)
    this.state = readonlyData(this.#state)
  }

  set(value: SortingState<TField>): void { this.#state.set({ ...value }) }
  setField(field: TField): void { this.#state.update((state) => ({ ...state, field })) }
  setDirection(direction: SortDirection): void { this.#state.update((state) => ({ ...state, direction })) }
  reset(): void { this.#state.set({ ...this.#initial }) }
}
