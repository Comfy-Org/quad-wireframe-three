import { BufferGeometry, Float32BufferAttribute } from 'three'

import { faceCount } from './types.js'
import type { PolygonMesh } from './types.js'

export function polygonEdges(mesh: PolygonMesh): Uint32Array {
  const seen = new Set<number>()
  const pairs: number[] = []
  const faces = faceCount(mesh)
  for (let f = 0; f < faces; f++) {
    const start = mesh.faceOffsets[f]
    const end = mesh.faceOffsets[f + 1]
    for (let i = start; i < end; i++) {
      const a = mesh.faceVertices[i]
      const b = mesh.faceVertices[i + 1 < end ? i + 1 : start]
      if (a === b) continue
      const lo = a < b ? a : b
      const hi = a < b ? b : a
      const key = lo * 0x100000000 + hi
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push(lo, hi)
    }
  }
  return Uint32Array.from(pairs)
}

export function createPolygonEdgesGeometry(mesh: PolygonMesh): BufferGeometry {
  const edges = polygonEdges(mesh)
  const positions = new Float32Array(edges.length * 3)
  for (let i = 0; i < edges.length; i++) {
    const v = edges[i] * 3
    positions[i * 3] = mesh.positions[v]
    positions[i * 3 + 1] = mesh.positions[v + 1]
    positions[i * 3 + 2] = mesh.positions[v + 2]
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}
