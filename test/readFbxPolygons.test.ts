import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readFbxPolygons } from '../src/index.js'
import { QUADBLOB, fixtureBuffer, loadFbxMesh } from './helpers.js'

describe('readFbxPolygons', () => {
  it('returns every polygon size of the Blender quad mesh', () => {
    const [geometry, ...rest] = readFbxPolygons(fixtureBuffer('quadblob.fbx'))
    assert.equal(rest.length, 0)
    assert.equal(geometry.faceSizes.length, QUADBLOB.faces)
    assert.ok(geometry.faceSizes.every((size) => size === 4))
  })

  it('names the geometry the same way three.js FBXLoader does', () => {
    const [geometry] = readFbxPolygons(fixtureBuffer('quadblob.fbx'))
    assert.equal(geometry.name, loadFbxMesh('quadblob.fbx').geometry.name)
    assert.doesNotMatch(geometry.name, /\0/)
  })

  it('returns nothing for a file without an Objects section', () => {
    const header = new Uint8Array(fixtureBuffer('quadblob.fbx'), 0, 27)
    const truncated = new Uint8Array(27 + 13)
    truncated.set(header)
    assert.deepEqual(readFbxPolygons(truncated.buffer), [])
  })
})
