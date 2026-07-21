export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`ApiError ${status}`)
    this.name = 'ApiError'
  }
}
