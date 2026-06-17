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
}

export type GraphLayout = {
  width: number
  height: number
  readers: GraphPoint[]
  targets: GraphPoint[]
  lines: GraphLine[]
}

export function buildGraphLayout(edges: readonly DependencyEdge[]): GraphLayout {
  const readers = Array.from(new Set(edges.map(edge => edge.readerId))).sort()
  const targets = Array.from(
    new Set(edges.map(edge => `${edge.targetId}.${edge.targetProp}`)),
  ).sort()

  const rowHeight = 38
  const top = 28
  const height = Math.max(readers.length, targets.length, 1) * rowHeight + top * 2
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

  const readerById = new Map(readerPoints.map(point => [point.id, point]))
  const targetById = new Map(targetPoints.map(point => [point.id, point]))

  return {
    width,
    height,
    readers: readerPoints,
    targets: targetPoints,
    lines: edges.flatMap(edge => {
      const from = readerById.get(edge.readerId)
      const to = targetById.get(`${edge.targetId}.${edge.targetProp}`)

      return from && to ? [{ edge, from, to }] : []
    }),
  }
}
