import {
  decodeArray,
  findChild,
  findChildren,
  isArrayProp,
  parseBinaryFbx
} from './binaryFbx.js'
import type { FbxNode } from './binaryFbx.js'
import { faceSizesFromPolygonVertexIndex } from './faceSizes.js'

export interface FbxGeometryPolygons {
  readonly id: bigint | number
  readonly name: string
  readonly faceSizes: Uint32Array
}

function threeStyleName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const nul = raw.indexOf('\0')
  return nul >= 0 ? raw.slice(0, nul) : raw
}

function polygonsOf(geometryNode: FbxNode): FbxGeometryPolygons | null {
  const polygonVertexIndex = findChild(geometryNode, 'PolygonVertexIndex')
  const prop = polygonVertexIndex?.props[0]
  if (!isArrayProp(prop) || prop.type !== 'i') return null
  const indices = decodeArray(prop) as Int32Array
  const id = geometryNode.props[0]
  return {
    id: typeof id === 'bigint' || typeof id === 'number' ? id : 0,
    name: threeStyleName(geometryNode.props[1]),
    faceSizes: faceSizesFromPolygonVertexIndex(indices)
  }
}

export function readFbxPolygons(buffer: ArrayBuffer): FbxGeometryPolygons[] {
  const document = parseBinaryFbx(buffer)
  const objects = document.nodes.find((node) => node.name === 'Objects')
  if (!objects) return []
  return findChildren(objects, 'Geometry')
    .map(polygonsOf)
    .filter((entry): entry is FbxGeometryPolygons => entry !== null)
}
