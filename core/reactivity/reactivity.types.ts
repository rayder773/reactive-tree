export type Accessor<T> = () => T

export interface ReactiveSubscription {
	dispose(): void
}

export interface ReactiveSource<T> {
	get(): T
	subscribe(callback: () => void): ReactiveSubscription
}

export interface ReactiveRef<T> extends ReactiveSource<T> {
	set(value: T): void
	update(callback: (value: T) => T): void
}

export interface ReactiveComputed<T> extends ReactiveSource<T> {
	readonly dirty: boolean
}

export interface ReactivityApi {
	ref<T>(value: T): ReactiveRef<T>
	computed<T>(callback: Accessor<T>): ReactiveComputed<T>
	reactive<T extends object>(value: T): T
	toComputed<T>(value: T | Accessor<T> | ReactiveSource<T>): ReactiveComputed<T>
	isReactiveSource<T>(value: unknown): value is ReactiveSource<T>
}
