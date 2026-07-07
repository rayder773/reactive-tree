export interface DomBinding {
	prop: string
	sourceNode: any | null
	readerNodeId?: string
	tag: string | null
	editable: boolean
	sourceLocation?: { file: string; line: number }
}
