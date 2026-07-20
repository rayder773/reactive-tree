export type Unsubscribe = () => void

export type DataSubscriber<T> = (value: T, previousValue: T) => void

export interface ReadonlyData<T> {
  readonly value: T
  get(): T
  subscribe(subscriber: DataSubscriber<T>): Unsubscribe
}

export interface Data<T> extends ReadonlyData<T> {
  set(value: T): void
  update(updater: (current: T) => T): void
}

export interface DataAdapter {
  create<T>(initialValue: T): Data<T>
}
