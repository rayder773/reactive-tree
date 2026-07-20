import { data, readonlyData, type Data, type ReadonlyData } from '../data'

export interface PaginationState { page: number; pageSize: number; total: number }

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`)
}

export class PaginationService {
  readonly #initial: PaginationState
  readonly #state: Data<PaginationState>
  readonly state: ReadonlyData<PaginationState>

  constructor(initial: Partial<PaginationState> = {}) {
    const value = { page: 1, pageSize: 20, total: 0, ...initial }
    positiveInteger(value.page, 'page')
    positiveInteger(value.pageSize, 'pageSize')
    if (value.total < 0) throw new RangeError('total must not be negative')
    this.#initial = value
    this.#state = data({ ...value })
    this.state = readonlyData(this.#state)
  }

  setPage(page: number): void { positiveInteger(page, 'page'); this.#state.update((state) => ({ ...state, page })) }
  setPageSize(pageSize: number): void { positiveInteger(pageSize, 'pageSize'); this.#state.update((state) => ({ ...state, pageSize })) }
  setTotal(total: number): void {
    if (!Number.isInteger(total) || total < 0) throw new RangeError('total must be a non-negative integer')
    this.#state.update((state) => ({ ...state, total }))
  }
  reset(): void { this.#state.set({ ...this.#initial }) }
}
