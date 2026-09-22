export function faceSizesFromPolygonVertexIndex(
  polygonVertexIndex: ArrayLike<number>
): Uint32Array {
  let faceCount = 0
  for (let i = 0; i < polygonVertexIndex.length; i++) {
    if (polygonVertexIndex[i] < 0) faceCount++
  }

  const sizes = new Uint32Array(faceCount)
  let size = 0
  let face = 0
  for (let i = 0; i < polygonVertexIndex.length; i++) {
    size++
    if (polygonVertexIndex[i] < 0) {
      sizes[face++] = size
      size = 0
    }
  }
  return sizes
}

export function triangleCountOf(faceSizes: ArrayLike<number>): number {
  let triangles = 0
  for (let i = 0; i < faceSizes.length; i++) {
    const size = faceSizes[i]
    if (size >= 3) triangles += size - 2
  }
  return triangles
}
