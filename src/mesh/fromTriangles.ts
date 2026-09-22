import { triangleCountOf } from '../fbx/faceSizes.js'
import { polygonMeshFromFaces, positionAttributeOf } from './types.js'
import type { PolygonMesh, TriangleSource } from './types.js'
import { weldPositions } from './weld.js'

function weldedTriangles(geometry: TriangleSource): {
  positions: Float32Array
  corners: Uint32Array
} {
  const position = positionAttributeOf(geometry)
  const { positions, remap } = weldPositions(position)
  const index = geometry.index?.array
  const cornerCount = index ? index.length : position.count
  const corners = new Uint32Array(cornerCount)
  for (let i = 0; i < cornerCount; i++) {
    corners[i] = remap[index ? index[i] : i]
  }
  return { positions, corners }
}

function isDegenerate(a: number, b: number, c: number): boolean {
  return a === b || b === c || a === c
}

function perimeterLoop(
  corners: Uint32Array,
  firstTriangle: number,
  triangleCount: number,
  expectedSize: number
): number[] | null {
  const edgeUses = new Map<number, number>()
  const neighbors = new Map<number, number[]>()
  const vertexIds = new Set<number>()
  for (let t = firstTriangle; t < firstTriangle + triangleCount; t++) {
    for (let e = 0; e < 3; e++) {
      const a = corners[t * 3 + e]
      const b = corners[t * 3 + ((e + 1) % 3)]
      vertexIds.add(a)
      const key = a < b ? a * 0x100000000 + b : b * 0x100000000 + a
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1)
    }
  }
  if (vertexIds.size !== expectedSize) return null

  for (let t = firstTriangle; t < firstTriangle + triangleCount; t++) {
    for (let e = 0; e < 3; e++) {
      const a = corners[t * 3 + e]
      const b = corners[t * 3 + ((e + 1) % 3)]
      const key = a < b ? a * 0x100000000 + b : b * 0x100000000 + a
      if (edgeUses.get(key) !== 1) continue
      const fromA = neighbors.get(a)
      if (fromA) fromA.push(b)
      else neighbors.set(a, [b])
      const fromB = neighbors.get(b)
      if (fromB) fromB.push(a)
      else neighbors.set(b, [a])
    }
  }

  let start = -1
  let second = -1
  for (let e = 0; e < 3 && start < 0; e++) {
    const a = corners[firstTriangle * 3 + e]
    const b = corners[firstTriangle * 3 + ((e + 1) % 3)]
    const key = a < b ? a * 0x100000000 + b : b * 0x100000000 + a
    if (edgeUses.get(key) === 1) {
      start = a
      second = b
    }
  }
  if (start < 0) return null

  const loop = [start, second]
  let previous = start
  let current = second
  while (loop.length < expectedSize) {
    const next = neighbors.get(current)?.find((v) => v !== previous)
    if (next === undefined || next === start) return null
    loop.push(next)
    previous = current
    current = next
  }
  const closes = neighbors.get(current)?.includes(start) ?? false
  return closes ? loop : null
}

export function polygonMeshFromTriangles(
  geometry: TriangleSource,
  faceSizes?: ArrayLike<number>
): PolygonMesh {
  const { positions, corners } = weldedTriangles(geometry)
  const triangleCount = Math.floor(corners.length / 3)
  const faces: ArrayLike<number>[] = []

  if (!faceSizes) {
    for (let t = 0; t < triangleCount; t++) {
      const a = corners[t * 3]
      const b = corners[t * 3 + 1]
      const c = corners[t * 3 + 2]
      if (!isDegenerate(a, b, c)) faces.push([a, b, c])
    }
    return polygonMeshFromFaces(positions, faces)
  }

  const expectedTriangles = triangleCountOf(faceSizes)
  if (expectedTriangles !== triangleCount) {
    throw new Error(
      `faceSizes describe ${expectedTriangles} triangles but geometry has ${triangleCount}`
    )
  }

  let triangle = 0
  for (let f = 0; f < faceSizes.length; f++) {
    const size = faceSizes[f]
    if (size < 3) continue
    const span = size - 2
    if (size === 3) {
      const a = corners[triangle * 3]
      const b = corners[triangle * 3 + 1]
      const c = corners[triangle * 3 + 2]
      if (!isDegenerate(a, b, c)) faces.push([a, b, c])
    } else {
      const loop = perimeterLoop(corners, triangle, span, size)
      if (loop) {
        faces.push(loop)
      } else {
        for (let t = triangle; t < triangle + span; t++) {
          const a = corners[t * 3]
          const b = corners[t * 3 + 1]
          const c = corners[t * 3 + 2]
          if (!isDegenerate(a, b, c)) faces.push([a, b, c])
        }
      }
    }
    triangle += span
  }
  return polygonMeshFromFaces(positions, faces)
}
