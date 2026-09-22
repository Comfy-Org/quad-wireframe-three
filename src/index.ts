import type { BufferGeometry } from 'three'

import type { FbxGeometryPolygons } from './fbx/readFbxPolygons.js'
import { triangleCountOf } from './fbx/faceSizes.js'
import { joinTriangles } from './join/joinTriangles.js'
import type { JoinTrianglesOptions } from './join/joinTriangles.js'
import { createPolygonEdgesGeometry } from './mesh/edges.js'
import { polygonMeshFromTriangles } from './mesh/fromTriangles.js'
import { positionAttributeOf } from './mesh/types.js'
import type { PolygonMesh, TriangleSource } from './mesh/types.js'

export {
  parseBinaryFbx,
  isBinaryFbx,
  decodeArray,
  findChild,
  findChildren,
  isArrayProp
} from './fbx/binaryFbx.js'
export type {
  FbxDocument,
  FbxNode,
  FbxProp,
  FbxArrayProp,
  FbxArrayType,
  FbxDecodedArray
} from './fbx/binaryFbx.js'
export { faceSizesFromPolygonVertexIndex, triangleCountOf } from './fbx/faceSizes.js'
export { readFbxPolygons } from './fbx/readFbxPolygons.js'
export type { FbxGeometryPolygons } from './fbx/readFbxPolygons.js'

export {
  FB_NGON_ENCODING,
  hasNgonEncoding,
  ngonEncodedFaceSizes
} from './gltf/ngonEncoding.js'

export {
  faceCount,
  vertexCount,
  faceSizeOf,
  faceSizesOf,
  polygonMeshFromFaces,
  positionAttributeOf
} from './mesh/types.js'
export type { PolygonMesh, PositionSource, TriangleSource } from './mesh/types.js'
export { weldPositions } from './mesh/weld.js'
export type { WeldResult } from './mesh/weld.js'
export { polygonMeshFromTriangles } from './mesh/fromTriangles.js'
export { polygonEdges, createPolygonEdgesGeometry } from './mesh/edges.js'

export { joinTriangles, DEFAULT_JOIN_OPTIONS } from './join/joinTriangles.js'
export type { JoinTrianglesOptions } from './join/joinTriangles.js'
export { quadError, isQuadFlipped } from './join/quadError.js'

export interface TriangleGeometryLike extends TriangleSource {
  readonly name?: string
}

function triangleCountOfGeometry(geometry: TriangleSource): number {
  const corners = geometry.index
    ? geometry.index.array.length
    : positionAttributeOf(geometry).count
  return Math.floor(corners / 3)
}

export function matchFbxPolygons(
  polygons: readonly FbxGeometryPolygons[],
  geometry: TriangleGeometryLike
): Uint32Array | null {
  const triangles = triangleCountOfGeometry(geometry)
  const fits = polygons.filter((entry) => triangleCountOf(entry.faceSizes) === triangles)
  if (fits.length === 0) return null
  const byName = geometry.name ? fits.filter((entry) => entry.name === geometry.name) : []
  if (byName.length === 1) return byName[0].faceSizes
  return fits.length === 1 ? fits[0].faceSizes : null
}

export interface QuadWireframeOptions {
  faceSizes?: ArrayLike<number> | null
  join?: boolean | JoinTrianglesOptions
}

export function polygonMeshOf(
  geometry: TriangleSource,
  options: QuadWireframeOptions = {}
): PolygonMesh {
  if (options.faceSizes) return polygonMeshFromTriangles(geometry, options.faceSizes)
  const triangles = polygonMeshFromTriangles(geometry)
  if (options.join === false) return triangles
  return joinTriangles(triangles, options.join === true ? undefined : options.join)
}

export function createQuadWireframeGeometry(
  geometry: TriangleSource,
  options: QuadWireframeOptions = {}
): BufferGeometry {
  return createPolygonEdgesGeometry(polygonMeshOf(geometry, options))
}
