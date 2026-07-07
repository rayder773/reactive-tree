import type { DependencyEdge } from '../../../../../src'

export type GraphPoint = {
	id: string
	x: number
	y: number
}

export type GraphLine = {
	edge: DependencyEdge
	from: GraphPoint
	to: GraphPoint
	isCross: boolean
}

export type GraphLayout = {
	width: number
	height: number
	readers: GraphPoint[]
	targets: GraphPoint[]
	lines: GraphLine[]
}

export function buildGraphLayout(
	edges: readonly DependencyEdge[],
	crossEdges: readonly DependencyEdge[] = [],
): GraphLayout {
	const allEdges = [...edges, ...crossEdges]
	const crossEdgeKeys = new Set(
		crossEdges.map(
			(e) => `${e.readerId}\0${e.targetId}\0${e.targetProp}\0${e.reason}`,
		),
	)

	const readers = Array.from(
		new Set(allEdges.map((edge) => edge.readerId)),
	).sort()
	const targets = Array.from(
		new Set(allEdges.map((edge) => `${edge.targetId}.${edge.targetProp}`)),
	).sort()

	const rowHeight = 38
	const top = 28
	const height =
		Math.max(readers.length, targets.length, 1) * rowHeight + top * 2
	const width = 760

	const readerPoints = readers.map((id, index) => ({
		id,
		x: 160,
		y: top + index * rowHeight,
	}))
	const targetPoints = targets.map((id, index) => ({
		id,
		x: 560,
		y: top + index * rowHeight,
	}))

	const readerById = new Map(readerPoints.map((point) => [point.id, point]))
	const targetById = new Map(targetPoints.map((point) => [point.id, point]))

	return {
		width,
		height,
		readers: readerPoints,
		targets: targetPoints,
		lines: allEdges.flatMap((edge) => {
			const from = readerById.get(edge.readerId)
			const to = targetById.get(`${edge.targetId}.${edge.targetProp}`)
			const isCross = crossEdgeKeys.has(
				`${edge.readerId}\0${edge.targetId}\0${edge.targetProp}\0${edge.reason}`,
			)

			return from && to ? [{ edge, from, to, isCross }] : []
		}),
	}
}
