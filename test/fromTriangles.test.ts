import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BoxGeometry, PlaneGeometry } from 'three'

import {
  faceCount,
  faceSizesOf,
  polygonEdges,
  polygonMeshFromTriangles,
  readFbxPolygons,
  vertexCount
} from '../src/index.js'
import { QUADBLOB, fixtureBuffer, loadFbxMesh } from './helpers.js'

describe('polygonMeshFromTriangles', () => {
  it('welds a non-indexed FBX triangle soup into one triangle per face', () => {
    const mesh = polygonMeshFromTriangles(loadFbxMesh('quadblob.fbx').geometry)
    assert.equal(vertexCount(mesh), QUADBLOB.vertices)
    assert.equal(faceCount(mesh), QUADBLOB.triangles)
    assert.ok(faceSizesOf(mesh).every((size) => size === 3))
  })

  it('regroups FBXLoader triangles into the file polygons', () => {
    const [{ faceSizes }] = readFbxPolygons(fixtureBuffer('quadblob.fbx'))
    const mesh = polygonMeshFromTriangles(loadFbxMesh('quadblob.fbx').geometry, faceSizes)
    assert.equal(faceCount(mesh), QUADBLOB.faces)
    assert.ok(faceSizesOf(mesh).every((size) => size === 4))
    assert.equal(polygonEdges(mesh).length / 2, QUADBLOB.edges)
  })

  it('keeps quad winding consistent with the source triangles', () => {
    const [{ faceSizes }] = readFbxPolygons(fixtureBuffer('quadblob.fbx'))
    const geometry = loadFbxMesh('quadblob.fbx').geometry
    const mesh = polygonMeshFromTriangles(geometry, faceSizes)
    const quad = Array.from(mesh.faceVertices.subarray(0, 4))
    const firstTriangle = polygonMeshFromTriangles(geometry).faceVertices.subarray(0, 3)
    const a = quad.indexOf(firstTriangle[0])
    const b = quad.indexOf(firstTriangle[1])
    const c = quad.indexOf(firstTriangle[2])
    const forward = [(a + 1) % 4, (b + 1) % 4].includes(b) && (c - b + 4) % 4 <= 2
    assert.ok(forward, `quad ${quad} does not follow triangle ${Array.from(firstTriangle)}`)
  })

  it('handles indexed three.js geometry (PlaneGeometry cells are consecutive triangle pairs)', () => {
    const plane = new PlaneGeometry(2, 2, 3, 2)
    const mesh = polygonMeshFromTriangles(plane, new Uint32Array(6).fill(4))
    assert.equal(faceCount(mesh), 6)
    assert.equal(polygonEdges(mesh).length / 2, 3 * 3 + 4 * 2)
  })

  it('welds BoxGeometry corners so the cube has 8 vertices and 12 edges', () => {
    const mesh = polygonMeshFromTriangles(new BoxGeometry(), new Uint32Array(6).fill(4))
    assert.equal(vertexCount(mesh), 8)
    assert.equal(faceCount(mesh), 6)
    assert.equal(polygonEdges(mesh).length / 2, 12)
  })

  it('passes triangles and n-gons through faceSizes', () => {
    const positions = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [2, 0, 0], [3, 0, 0], [3, 1, 0], [2.5, 1.5, 0], [2, 1, 0],
      [5, 0, 0], [6, 0, 0], [5, 1, 0]
    ]
    const corners = [
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7, 4, 7, 8,
      9, 10, 11
    ]
    const mesh = polygonMeshFromTriangles(source(positions, corners), [4, 5, 3])
    assert.deepEqual(Array.from(faceSizesOf(mesh)), [4, 5, 3])
    assert.deepEqual(Array.from(mesh.faceVertices.subarray(4, 9)), [4, 5, 6, 7, 8])
  })

  it('drops degenerate triangles and skips faces smaller than three', () => {
    const positions = [[0, 0, 0], [1, 0, 0], [1, 1, 0]]
    const mesh = polygonMeshFromTriangles(source(positions, [0, 1, 2, 0, 0, 1]))
    assert.equal(faceCount(mesh), 1)
    const sized = polygonMeshFromTriangles(source(positions, [0, 1, 2, 1, 1, 2]), [3, 3])
    assert.equal(faceCount(sized), 1)
  })

  it('falls back to triangles when a polygon cannot be walked', () => {
    const positions = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [5, 5, 0], [6, 5, 0]]
    const duplicated = polygonMeshFromTriangles(source(positions, [0, 1, 2, 0, 1, 2]), [4])
    assert.deepEqual(Array.from(faceSizesOf(duplicated)), [3, 3])
    const disjoint = polygonMeshFromTriangles(source(positions, [0, 1, 2, 3, 4, 5]), [4])
    assert.deepEqual(Array.from(faceSizesOf(disjoint)), [3, 3])
  })

  it('rejects faceSizes that do not add up to the triangle count', () => {
    assert.throws(
      () => polygonMeshFromTriangles(new BoxGeometry(), [4, 4, 4]),
      /describe 6 triangles but geometry has 12/
    )
  })
})

function source(positions: number[][], corners: number[]) {
  return {
    getAttribute: () => ({
      count: positions.length,
      getX: (i: number) => positions[i][0],
      getY: (i: number) => positions[i][1],
      getZ: (i: number) => positions[i][2]
    }),
    index: { array: corners }
  }
}
