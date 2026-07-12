export interface ExampleMountContext {
	element: HTMLElement
}

export interface ExampleInstance {
	dispose(): void
}

export interface ExampleDefinition {
	id: string
	title: string
	description: string
	mount(context: ExampleMountContext): ExampleInstance
}
