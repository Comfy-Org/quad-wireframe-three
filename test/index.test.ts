import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BoxGeometry } from 'three'

import {
  createQuadWireframeGeometry,
  faceCount,
  faceSizesOf,
  matchFbxPolygons,
  polygonMeshOf,
  readFbxPolygons
} from '../src/index.js'
import { QUADBLOB, fixtureBuffer, loadFbxMesh } from './helpers.js'

describe('matchFbxPolygons', () => {
  const polygons = readFbxPolygons(fixtureBuffer('quadblob.fbx'))

  it('matches by name when the triangle count agrees', () => {
    const geometry = loadFbxMesh('quadblob.fbx').geometry
    assert.equal(matchFbxPolygons(polygons, geometry)?.length, QUADBLOB.faces)
  })

  it('falls back to a unique triangle count when the name differs', () => {
    const geometry = loadFbxMesh('quadblob.fbx').geometry
    geometry.name = 'renamed'
    assert.equal(matchFbxPolygons(polygons, geometry)?.length, QUADBLOB.faces)
  })

  it('returns null when the geometry has a different triangle count or is ambiguous', () => {
    assert.equal(matchFbxPolygons(polygons, new BoxGeometry()), null)
    const twins = [polygons[0], { ...polygons[0], name: 'other' }]
    const geometry = loadFbxMesh('quadblob.fbx').geometry
    geometry.name = 'neither'
    assert.equal(matchFbxPolygons(twins, geometry), null)
    geometry.name = 'other'
    assert.equal(matchFbxPolygons(twins, geometry)?.length, QUADBLOB.faces)
  })
})

describe('polygonMeshOf / createQuadWireframeGeometry', () => {
  it('uses face sizes when given', () => {
    const [{ faceSizes }] = readFbxPolygons(fixtureBuffer('quadblob.fbx'))
    const mesh = polygonMeshOf(loadFbxMesh('quadblob.fbx').geometry, { faceSizes })
    assert.equal(faceCount(mesh), QUADBLOB.faces)
  })

  it('joins triangles by default and can be told not to', () => {
    const box = new BoxGeometry()
    assert.equal(faceCount(polygonMeshOf(box)), 6)
    assert.equal(faceCount(polygonMeshOf(box, { join: true })), 6)
    assert.equal(faceCount(polygonMeshOf(box, { join: false })), 12)
    assert.equal(faceCount(polygonMeshOf(box, { join: { shapeAngleThreshold: 0 } })), 12)
  })

  it('produces a LineSegments geometry with only the polygon edges', () => {
    const wire = createQuadWireframeGeometry(new BoxGeometry())
    assert.equal(wire.getAttribute('position').count, 12 * 2)
    const triangulated = createQuadWireframeGeometry(new BoxGeometry(), { join: false })
    assert.equal(triangulated.getAttribute('position').count, 18 * 2)
    assert.ok(faceSizesOf(polygonMeshOf(new BoxGeometry())).every((size) => size === 4))
  })
})
