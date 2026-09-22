import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { zlibSync } from 'fflate'

import {
  decodeArray,
  findChild,
  findChildren,
  isArrayProp,
  isBinaryFbx,
  parseBinaryFbx
} from '../src/index.js'
import type { FbxArrayProp } from '../src/index.js'
import { QUADBLOB, fixtureBuffer } from './helpers.js'

describe('isBinaryFbx', () => {
  it('accepts the Kaydara binary header', () => {
    assert.equal(isBinaryFbx(fixtureBuffer('quadblob.fbx')), true)
  })

  it('rejects ASCII FBX and short buffers', () => {
    const ascii = new TextEncoder().encode('; FBX 7.4.0 project file\nFBXHeaderExtension: {\n}')
    assert.equal(isBinaryFbx(ascii.buffer), false)
    assert.equal(isBinaryFbx(new ArrayBuffer(4)), false)
  })
})

describe('parseBinaryFbx', () => {
  it('throws on non-FBX input', () => {
    assert.throws(() => parseBinaryFbx(new ArrayBuffer(64)), /binary FBX/)
  })

  it('reads the node tree down to the polygon index array', () => {
    const document = parseBinaryFbx(fixtureBuffer('quadblob.fbx'))
    assert.ok(document.version >= 7100)

    const objects = document.nodes.find((node) => node.name === 'Objects')
    assert.ok(objects)
    const geometries = findChildren(objects, 'Geometry')
    assert.equal(geometries.length, 1)
    assert.equal(typeof geometries[0].props[0], 'bigint')
    assert.equal(geometries[0].props[2], 'Mesh')

    const polygons = findChild(geometries[0], 'PolygonVertexIndex')
    assert.ok(polygons)
    const prop = polygons.props[0]
    assert.ok(isArrayProp(prop))
    assert.equal(prop.type, 'i')
    assert.equal(prop.length, QUADBLOB.faces * 4)
    const indices = decodeArray(prop)
    assert.ok(indices instanceof Int32Array)
    assert.equal(indices.length, QUADBLOB.faces * 4)
  })

  it('parses every scalar property type without desynchronising', () => {
    const document = parseBinaryFbx(fixtureBuffer('quadblob.fbx'))
    const header = document.nodes.find((node) => node.name === 'FBXHeaderExtension')
    assert.ok(header)
    const version = findChild(header, 'FBXVersion')
    assert.equal(typeof version?.props[0], 'number')
    const creator = findChild(header, 'Creator')
    assert.match(String(creator?.props[0]), /Blender/)
  })
})

describe('decodeArray', () => {
  const samples: { type: FbxArrayProp['type']; bytes: Uint8Array; expected: unknown }[] = [
    { type: 'i', bytes: new Uint8Array(new Int32Array([1, -2, 3]).buffer), expected: [1, -2, 3] },
    { type: 'f', bytes: new Uint8Array(new Float32Array([0.5, 1.5]).buffer), expected: [0.5, 1.5] },
    { type: 'd', bytes: new Uint8Array(new Float64Array([2.25]).buffer), expected: [2.25] },
    { type: 'l', bytes: new Uint8Array(new BigInt64Array([7n]).buffer), expected: [7n] },
    { type: 'b', bytes: new Uint8Array([1, 0]), expected: [1, 0] }
  ]
  for (const { type, bytes, expected } of samples) {
    it(`decodes '${type}' arrays raw and zlib-compressed`, () => {
      const length = Array.isArray(expected) ? expected.length : 0
      const raw: FbxArrayProp = { kind: 'array', type, length, encoding: 0, bytes }
      assert.deepEqual(Array.from(decodeArray(raw) as ArrayLike<unknown>), expected)
      const packed: FbxArrayProp = {
        kind: 'array',
        type,
        length,
        encoding: 1,
        bytes: zlibSync(bytes)
      }
      assert.deepEqual(Array.from(decodeArray(packed) as ArrayLike<unknown>), expected)
    })
  }

  it('rejects arrays whose payload is shorter than declared', () => {
    const truncated: FbxArrayProp = {
      kind: 'array',
      type: 'i',
      length: 4,
      encoding: 0,
      bytes: new Uint8Array(4)
    }
    assert.throws(() => decodeArray(truncated), /too short/)
  })

  it('reads unaligned array views correctly', () => {
    const backing = new Uint8Array(1 + 8)
    backing.set(new Uint8Array(new Int32Array([42, -1]).buffer), 1)
    const prop: FbxArrayProp = {
      kind: 'array',
      type: 'i',
      length: 2,
      encoding: 0,
      bytes: backing.subarray(1)
    }
    assert.deepEqual(Array.from(decodeArray(prop) as Int32Array), [42, -1])
  })
})

describe('isArrayProp', () => {
  it('distinguishes array props from scalars and raw blobs', () => {
    assert.equal(isArrayProp(new Uint8Array(2)), false)
    assert.equal(isArrayProp('Mesh'), false)
    assert.equal(isArrayProp(undefined), false)
    assert.equal(
      isArrayProp({ kind: 'array', type: 'i', length: 0, encoding: 0, bytes: new Uint8Array() }),
      true
    )
  })
})
