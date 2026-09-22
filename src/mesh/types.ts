export interface PolygonMesh {
  readonly positions: Float32Array
  readonly faceOffsets: Uint32Array
  readonly faceVertices: Uint32Array
}

export interface PositionSource {
  readonly count: number
  getX(index: number): number
  getY(index: number): number
  getZ(index: number): number
}

export interface TriangleSource {
  getAttribute(name: 'position'): PositionSource | undefined
  readonly index?: { readonly array: ArrayLike<number> } | null
}

export function positionAttributeOf(geometry: TriangleSource): PositionSource {
  const position = geometry.getAttribute('position')
  if (!position) throw new Error('geometry has no position attribute')
  return position
}

export function faceCount(mesh: PolygonMesh): number {
  return mesh.faceOffsets.length - 1
}

export function vertexCount(mesh: PolygonMesh): number {
  return mesh.positions.length / 3
}

export function faceSizeOf(mesh: PolygonMesh, face: number): number {
  return mesh.faceOffsets[face + 1] - mesh.faceOffsets[face]
}

export function faceSizesOf(mesh: PolygonMesh): Uint32Array {
  const count = faceCount(mesh)
  const sizes = new Uint32Array(count)
  for (let f = 0; f < count; f++) sizes[f] = faceSizeOf(mesh, f)
  return sizes
}

export function polygonMeshFromFaces(
  positions: Float32Array,
  faces: ReadonlyArray<ArrayLike<number>>
): PolygonMesh {
  const faceOffsets = new Uint32Array(faces.length + 1)
  let total = 0
  for (let f = 0; f < faces.length; f++) {
    faceOffsets[f] = total
    total += faces[f].length
  }
  faceOffsets[faces.length] = total

  const faceVertices = new Uint32Array(total)
  let cursor = 0
  for (const face of faces) {
    for (let i = 0; i < face.length; i++) faceVertices[cursor++] = face[i]
  }
  return { positions, faceOffsets, faceVertices }
}
