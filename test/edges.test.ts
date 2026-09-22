import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createPolygonEdgesGeometry,
  polygonEdges,
  polygonMeshFromFaces
} from '../src/index.js'

describe('polygonEdges', () => {
  it('lists each shared edge once and never a diagonal', () => {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0, 2, 1, 0])
    const mesh = polygonMeshFromFaces(positions, [
      [0, 1, 2, 3],
      [1, 4, 5, 2]
    ])
    const edges = polygonEdges(mesh)
    assert.equal(edges.length / 2, 7)
    const pairs = new Set<string>()
    for (let i = 0; i < edges.length; i += 2) pairs.add(`${edges[i]}-${edges[i + 1]}`)
    assert.ok(pairs.has('1-2'))
    assert.ok(!pairs.has('0-2'))
    assert.ok(!pairs.has('1-5'))
  })

  it('skips zero-length edges from repeated corners', () => {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0])
    const mesh = polygonMeshFromFaces(positions, [[0, 1, 1, 2]])
    assert.equal(polygonEdges(mesh).length / 2, 3)
  })
})

describe('createPolygonEdgesGeometry', () => {
  it('emits two positions per edge for LineSegments', () => {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])
    const geometry = createPolygonEdgesGeometry(polygonMeshFromFaces(positions, [[0, 1, 2, 3]]))
    const attribute = geometry.getAttribute('position')
    assert.equal(attribute.count, 8)
    assert.deepEqual(Array.from(attribute.array.slice(0, 6)), [0, 0, 0, 1, 0, 0])
  })
})
