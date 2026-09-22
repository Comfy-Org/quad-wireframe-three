import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh } from 'three'

import {
  FB_NGON_ENCODING,
  faceCount,
  faceSizesOf,
  hasNgonEncoding,
  ngonEncodedFaceSizes,
  polygonEdges,
  polygonMeshFromTriangles
} from '../src/index.js'
import { QUADBLOB, loadGlbMesh } from './helpers.js'

function indexed(positions: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

describe('hasNgonEncoding', () => {
  it('reads the flag GLTFLoader leaves on mesh.userData.gltfExtensions', () => {
    const mesh = new Mesh()
    assert.equal(hasNgonEncoding(mesh), false)
    mesh.userData.gltfExtensions = { [FB_NGON_ENCODING]: {} }
    assert.equal(hasNgonEncoding(mesh), true)
    assert.equal(hasNgonEncoding({}), false)
  })
})

describe('ngonEncodedFaceSizes', () => {
  it('groups consecutive triangles that share their first index into one polygon', () => {
    const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 3, 1, 0, 2.5, 1.5, 0, 2, 1, 0, 5, 0, 0, 6, 0, 0, 5, 1, 0]
    const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 4, 7, 8, 9, 10, 11]
    assert.deepEqual(Array.from(ngonEncodedFaceSizes(indexed(positions, indices))), [4, 5, 3])
  })

  it('treats every triangle as its own polygon when the geometry is not indexed', () => {
    const sizes = ngonEncodedFaceSizes(new BoxGeometry().toNonIndexed())
    assert.equal(sizes.length, 12)
    assert.ok(sizes.every((size) => size === 3))
  })

  it('recovers the Blender quads from a fan-ordered GLB and feeds polygonMeshFromTriangles', async () => {
    const geometry = (await loadGlbMesh('quadblob.glb')).geometry
    const sizes = ngonEncodedFaceSizes(geometry)
    assert.equal(sizes.length, QUADBLOB.faces)
    assert.ok(sizes.every((size) => size === 4))
    const mesh = polygonMeshFromTriangles(geometry, sizes)
    assert.equal(faceCount(mesh), QUADBLOB.faces)
    assert.ok(faceSizesOf(mesh).every((size) => size === 4))
    assert.equal(polygonEdges(mesh).length / 2, QUADBLOB.edges)
  })
})
