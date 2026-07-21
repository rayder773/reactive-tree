import { data, readonlyData, type Data, type ReadonlyData } from '../data'

export type SelectionMode = 'single' | 'multiple'

export class SelectionService<TId, TMode extends SelectionMode> {
  readonly #mode: TMode
  readonly #ids: Data<readonly TId[]> = data([])
  readonly ids: ReadonlyData<readonly TId[]> = readonlyData(this.#ids)

  constructor(mode: TMode) {
    this.#mode = mode
  }

  get mode(): TMode { return this.#mode }

  isSelected(id: TId): boolean { return this.#ids.get().some((value) => Object.is(value, id)) }

  select(id: TId): void {
    if (this.#mode === 'single') {
      this.#ids.set([id])
      return
    }
    if (!this.isSelected(id)) this.#ids.set([...this.#ids.get(), id])
  }

  deselect(id: TId): void {
    this.#ids.set(this.#ids.get().filter((value) => !Object.is(value, id)))
  }

  toggle(id: TId): void {
    if (this.isSelected(id)) this.deselect(id)
    else this.select(id)
  }

  replace(ids: readonly TId[]): void {
    const unique = [...new Set(ids)]
    this.#ids.set(this.#mode === 'single' ? unique.slice(0, 1) : unique)
  }

  clear(): void { this.#ids.set([]) }
}
