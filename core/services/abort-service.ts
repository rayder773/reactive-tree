export class AbortService<TKey> {
  readonly #controllers = new Map<TKey, AbortController>()
  #disposed = false

  create(key: TKey): AbortController {
    if (this.#disposed) throw new Error('AbortService has been disposed')
    if (this.#controllers.has(key)) throw new Error('AbortService key already exists')
    const controller = new AbortController()
    this.#controllers.set(key, controller)
    return controller
  }

  release(key: TKey): void {
    this.#controllers.delete(key)
  }

  abort(key: TKey): void {
    this.#controllers.get(key)?.abort()
    this.#controllers.delete(key)
  }

  abortAll(): void {
    for (const controller of this.#controllers.values()) controller.abort()
    this.#controllers.clear()
  }

  has(key: TKey): boolean {
    return this.#controllers.has(key)
  }

  keys(): readonly TKey[] {
    return [...this.#controllers.keys()]
  }

  dispose(): void {
    this.abortAll()
    this.#disposed = true
  }
}
