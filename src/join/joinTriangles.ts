import { faceCount, polygonMeshFromFaces } from '../mesh/types.js'
import type { PolygonMesh } from '../mesh/types.js'
import { IndexedMinHeap } from './heap.js'
import {
  cornerAngleDeviations,
  isQuadFlipped,
  quadEdgeDirections,
  quadError
} from './quadError.js'
import {
  add,
  angleNormalized,
  angleSignedOnAxis,
  dot,
  normalize,
  quadNormal,
  rotateAroundAxis,
  sub,
  triangleNormal,
  vertexAt
} from './vec3.js'
import type { Vec3 } from './vec3.js'

export interface JoinTrianglesOptions {
  faceAngleThreshold?: number
  shapeAngleThreshold?: number
  topologyInfluence?: number
}

const DEGREES = Math.PI / 180

export const DEFAULT_JOIN_OPTIONS: Required<JoinTrianglesOptions> = {
  faceAngleThreshold: 40 * DEGREES,
  shapeAngleThreshold: 40 * DEGREES,
  topologyInfluence: 1
}

const MAX_IMPROVEMENT = 0.99
const QUARTER_PI = Math.PI / 4

interface SharedLoop {
  readonly from: number
  readonly to: number
}

interface JoinState {
  readonly positions: Float32Array
  readonly faces: (number[] | null)[]
  readonly edgeLo: number[]
  readonly edgeHi: number[]
  readonly edgeFaces: number[][]
  readonly edgeIdOf: Map<number, number>
  readonly heap: IndexedMinHeap
  readonly options: Required<JoinTrianglesOptions>
  readonly faceAngleCos: number
  readonly inheritedNormals: Map<number, Vec3>
}

function edgeKey(a: number, b: number): number {
  return a < b ? a * 0x100000000 + b : b * 0x100000000 + a
}

function buildEdges(faces: (number[] | null)[]): {
  edgeLo: number[]
  edgeHi: number[]
  edgeFaces: number[][]
  edgeIdOf: Map<number, number>
} {
  const edgeLo: number[] = []
  const edgeHi: number[] = []
  const edgeFaces: number[][] = []
  const edgeIdOf = new Map<number, number>()
  faces.forEach((face, faceId) => {
    if (!face) return
    for (let i = 0; i < face.length; i++) {
      const a = face[i]
      const b = face[(i + 1) % face.length]
      const key = edgeKey(a, b)
      let edge = edgeIdOf.get(key)
      if (edge === undefined) {
        edge = edgeLo.length
        edgeIdOf.set(key, edge)
        edgeLo.push(Math.min(a, b))
        edgeHi.push(Math.max(a, b))
        edgeFaces.push([])
      }
      edgeFaces[edge].unshift(faceId)
    }
  })
  return { edgeLo, edgeHi, edgeFaces, edgeIdOf }
}

function isTriangle(state: JoinState, faceId: number): boolean {
  return state.faces[faceId]?.length === 3
}

function isMergeable(state: JoinState, edge: number): boolean {
  const owners = state.edgeFaces[edge]
  return owners.length === 2 && isTriangle(state, owners[0]) && isTriangle(state, owners[1])
}

function thirdVertex(face: number[], a: number, b: number): number {
  return face[0] !== a && face[0] !== b ? face[0] : face[1] !== a && face[1] !== b ? face[1] : face[2]
}

function followsInWinding(face: number[], a: number, b: number): boolean {
  const i = face.indexOf(a)
  return face[(i + 1) % face.length] === b
}

function quadCornersOf(state: JoinState, edge: number): [number, number, number, number] {
  const [faceA, faceB] = state.edgeFaces[edge]
  const triA = state.faces[faceA] as number[]
  const triB = state.faces[faceB] as number[]
  const lo = state.edgeLo[edge]
  const hi = state.edgeHi[edge]
  const from = followsInWinding(triA, lo, hi) ? lo : hi
  const to = from === lo ? hi : lo
  return [from, thirdVertex(triB, lo, hi), to, thirdVertex(triA, lo, hi)]
}

function joinedQuadOf(state: JoinState, edge: number): number[] {
  const cycle = quadCornersOf(state, edge)
  const triA = state.faces[state.edgeFaces[edge][0]] as number[]
  const [from, , to] = cycle
  const start = triA.find((corner, i) => {
    const next = triA[(i + 1) % 3]
    return !(corner === from && next === to)
  }) as number
  const offset = cycle.indexOf(start)
  return [0, 1, 2, 3].map((i) => cycle[(offset + i) % 4])
}

function cornerPositions(
  state: JoinState,
  corners: readonly [number, number, number, number]
): [Vec3, Vec3, Vec3, Vec3] {
  return [
    vertexAt(state.positions, corners[0]),
    vertexAt(state.positions, corners[1]),
    vertexAt(state.positions, corners[2]),
    vertexAt(state.positions, corners[3])
  ]
}

function faceNormal(state: JoinState, faceId: number): Vec3 {
  const face = state.faces[faceId] as number[]
  return triangleNormal(
    vertexAt(state.positions, face[0]),
    vertexAt(state.positions, face[1]),
    vertexAt(state.positions, face[2])
  )
}

function isDelimited(state: JoinState, edge: number): boolean {
  const { options } = state
  const [faceA, faceB] = state.edgeFaces[edge]
  if (options.faceAngleThreshold < Math.PI) {
    if (dot(faceNormal(state, faceA), faceNormal(state, faceB)) < state.faceAngleCos) {
      return true
    }
  }
  if (options.shapeAngleThreshold < Math.PI) {
    const [a, b, c, d] = cornerPositions(state, quadCornersOf(state, edge))
    if (isQuadFlipped(a, b, c, d)) return true
    const deviations = cornerAngleDeviations(quadEdgeDirections(a, b, c, d))
    if (deviations.some((deviation) => deviation > options.shapeAngleThreshold)) {
      return true
    }
  }
  return false
}

function mergeEdge(state: JoinState, edge: number): number {
  if (!isMergeable(state, edge)) return -1
  const [faceA, faceB] = state.edgeFaces[edge]
  const quad = joinedQuadOf(state, edge)
  state.inheritedNormals.set(faceA, faceNormal(state, faceA))
  for (const faceId of [faceA, faceB]) {
    const tri = state.faces[faceId] as number[]
    for (let i = 0; i < 3; i++) {
      const other = state.edgeIdOf.get(edgeKey(tri[i], tri[(i + 1) % 3])) as number
      if (other === edge) continue
      const owners = state.edgeFaces[other]
      owners.splice(owners.indexOf(faceId), 1)
      owners.unshift(faceA)
    }
  }
  state.faces[faceA] = quad
  state.faces[faceB] = null
  state.edgeFaces[edge] = []
  return faceA
}

function edgeBetween(state: JoinState, a: number, b: number): number {
  return state.edgeIdOf.get(edgeKey(a, b)) as number
}

function rotateToPlane(
  state: JoinState,
  corners: readonly [number, number, number, number],
  shared: SharedLoop,
  planeNormal: Vec3
): [Vec3, Vec3, Vec3, Vec3] {
  const pivot = vertexAt(state.positions, shared.from)
  const axis = normalize(sub(pivot, vertexAt(state.positions, shared.to)))
  const [a, b, c, d] = cornerPositions(state, corners)
  const radians = angleSignedOnAxis(planeNormal, quadNormal(a, b, c, d), axis)
  const rotated = corners.map((corner, i) => {
    const position = [a, b, c, d][i]
    if (corner === shared.from || corner === shared.to) return position
    return add(rotateAroundAxis(sub(position, pivot), axis, radians), pivot)
  })
  return rotated as [Vec3, Vec3, Vec3, Vec3]
}

function alignment(
  state: JoinState,
  neighbourEdges: readonly [Vec3, Vec3, Vec3, Vec3],
  corners: readonly [number, number, number, number],
  shared: SharedLoop,
  neighbourNormal: Vec3
): number {
  const [a, b, c, d] = rotateToPlane(state, corners, shared, neighbourNormal)
  const candidateEdges = quadEdgeDirections(a, b, c, d)
  const errors = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    const straight = Math.abs(angleNormalized(neighbourEdges[i], candidateEdges[i]))
    const rotated = Math.abs(angleNormalized(neighbourEdges[i], candidateEdges[(i + 1) % 4]))
    errors[0] += straight
    errors[1] += rotated
    errors[2] += Math.PI - straight
    errors[3] += Math.PI - rotated
  }
  const best = Math.min(...errors) / 4
  return Math.max(0, 1 - best / QUARTER_PI)
}

function reprioritizeEdge(
  state: JoinState,
  edge: number,
  shared: SharedLoop,
  neighbourEdges: readonly [Vec3, Vec3, Vec3, Vec3],
  neighbourError: number,
  neighbourNormal: Vec3
): void {
  if (!state.heap.has(edge)) return
  const current = state.heap.keyOf(edge)
  if (neighbourError > current) return
  const corners = quadCornersOf(state, edge)
  const factor = Math.min(
    state.options.topologyInfluence *
      alignment(state, neighbourEdges, corners, shared, neighbourNormal),
    MAX_IMPROVEMENT
  )
  state.heap.update(edge, current + (neighbourError - current) * factor)
}

function reprioritizeNeighbours(state: JoinState, quadId: number, quadErrorValue: number): void {
  const quad = state.faces[quadId] as number[]
  const candidates: { edge: number; shared: SharedLoop }[] = []
  for (let i = 0; i < 4; i++) {
    const from = quad[i]
    const to = quad[(i + 1) % 4]
    const owners = state.edgeFaces[edgeBetween(state, from, to)]
    if (owners.length !== 2) continue
    const neighbour = owners[0] === quadId ? owners[1] : owners[0]
    if (!isTriangle(state, neighbour)) continue
    const tri = state.faces[neighbour] as number[]
    const apex = thirdVertex(tri, from, to)
    for (const endpoint of [from, to]) {
      const edge = edgeBetween(state, apex, endpoint)
      if (!isMergeable(state, edge)) continue
      candidates.push({ edge, shared: { from: to, to: from } })
    }
  }
  if (candidates.length === 0) return

  const [a, b, c, d] = cornerPositions(state, quad as [number, number, number, number])
  const quadEdges = quadEdgeDirections(a, b, c, d)
  const normal = state.inheritedNormals.get(quadId) ?? quadNormal(a, b, c, d)
  for (const { edge, shared } of candidates) {
    reprioritizeEdge(state, edge, shared, quadEdges, quadErrorValue, normal)
  }
}

export function joinTriangles(mesh: PolygonMesh, options: JoinTrianglesOptions = {}): PolygonMesh {
  const resolved = { ...DEFAULT_JOIN_OPTIONS, ...options }
  const count = faceCount(mesh)
  const faces: (number[] | null)[] = []
  for (let f = 0; f < count; f++) {
    faces.push(Array.from(mesh.faceVertices.subarray(mesh.faceOffsets[f], mesh.faceOffsets[f + 1])))
  }
  const edges = buildEdges(faces)
  const state: JoinState = {
    positions: mesh.positions,
    faces,
    ...edges,
    heap: new IndexedMinHeap(edges.edgeLo.length),
    options: resolved,
    faceAngleCos: Math.cos(resolved.faceAngleThreshold),
    inheritedNormals: new Map()
  }

  for (let edge = 0; edge < state.edgeLo.length; edge++) {
    if (!isMergeable(state, edge) || isDelimited(state, edge)) continue
    const [a, b, c, d] = cornerPositions(state, quadCornersOf(state, edge))
    state.heap.push(edge, quadError(a, b, c, d))
  }

  const useTopology = resolved.topologyInfluence > 0
  if (useTopology && state.heap.size > 0) {
    faces.forEach((face, faceId) => {
      if (face?.length !== 4) return
      const [a, b, c, d] = cornerPositions(state, face as [number, number, number, number])
      const boosted = quadError(a, b, c, d) * (2 - resolved.topologyInfluence * MAX_IMPROVEMENT)
      reprioritizeNeighbours(state, faceId, boosted)
    })
  }

  while (state.heap.size > 0) {
    const error = state.heap.peekKey()
    const edge = state.heap.pop()
    const quadId = mergeEdge(state, edge)
    if (quadId >= 0 && useTopology) reprioritizeNeighbours(state, quadId, error)
  }

  return polygonMeshFromFaces(
    mesh.positions,
    faces.filter((face): face is number[] => face !== null)
  )
}
