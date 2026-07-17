export class AbortService<TKey> {
  readonly #controllers = new Map<TKey, AbortController>()
  #disposed = false

  async run<T>(key: TKey, callback: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.#disposed) throw new Error('AbortService has been disposed')
    this.abort(key)
    const controller = new AbortController()
    this.#controllers.set(key, controller)
    try {
      return await callback(controller.signal)
    } finally {
      if (this.#controllers.get(key) === controller) this.#controllers.delete(key)
    }
  }

  abort(key: TKey): void {
    this.#controllers.get(key)?.abort()
    this.#controllers.delete(key)
  }

  abortAll(): void {
    for (const controller of this.#controllers.values()) controller.abort()
    this.#controllers.clear()
  }

  dispose(): void {
    this.abortAll()
    this.#disposed = true
  }
}
