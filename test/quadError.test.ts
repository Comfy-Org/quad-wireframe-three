import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isQuadFlipped, quadError } from '../src/index.js'
import type { Vec3 } from '../src/join/vec3.js'
import { angleNormalized, angleSignedOnAxis, rotateAroundAxis } from '../src/join/vec3.js'

const square: Vec3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]
const parallelogram: Vec3[] = [[0, 0, 0], [1, 0, 0], [1.5, 1, 0], [0.5, 1, 0]]
const folded: Vec3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 1], [0, 1, 0]]
const concave: Vec3[] = [[0, 0, 0], [1, 0, 0], [0.2, 0.2, 0], [0, 1, 0]]
const bowtie: Vec3[] = [[0, 0, 0], [1, 1, 0], [1, 0, 0], [0, 1, 0]]

describe('quadError', () => {
  it('scores a flat square as zero', () => {
    assert.ok(quadError(...(square as [Vec3, Vec3, Vec3, Vec3])) < 1e-6)
  })

  it('ranks square < parallelogram < folded, and concave worst', () => {
    const errors = [square, parallelogram, folded, concave].map((quad) =>
      quadError(...(quad as [Vec3, Vec3, Vec3, Vec3]))
    )
    assert.ok(errors[0] < errors[1])
    assert.ok(errors[1] < errors[2])
    assert.ok(errors[3] > errors[1])
  })
})

describe('isQuadFlipped', () => {
  it('flags bow-ties and concave quads but not convex ones', () => {
    assert.equal(isQuadFlipped(...(square as [Vec3, Vec3, Vec3, Vec3])), false)
    assert.equal(isQuadFlipped(...(parallelogram as [Vec3, Vec3, Vec3, Vec3])), false)
    assert.equal(isQuadFlipped(...(bowtie as [Vec3, Vec3, Vec3, Vec3])), true)
    assert.equal(isQuadFlipped(...(concave as [Vec3, Vec3, Vec3, Vec3])), true)
  })
})

describe('vec3 angles', () => {
  it('angleNormalized matches acos for unit vectors in both hemispheres', () => {
    const cases: [Vec3, Vec3, number][] = [
      [[1, 0, 0], [0, 1, 0], Math.PI / 2],
      [[1, 0, 0], [-1, 0, 0], Math.PI],
      [[1, 0, 0], [1, 0, 0], 0],
      [[1, 0, 0], [Math.SQRT1_2, -Math.SQRT1_2, 0], Math.PI / 4]
    ]
    for (const [a, b, expected] of cases) {
      assert.ok(Math.abs(angleNormalized(a, b) - expected) < 1e-6)
    }
  })

  it('rotating by the signed angle brings the second vector onto the first', () => {
    const axis: Vec3 = [0, 0, 1]
    const from: Vec3 = [1, 0, 0]
    for (const to of [[0, 1, 0], [0, -1, 0], [-1, 0.2, 0]] as Vec3[]) {
      const radians = angleSignedOnAxis(from, to, axis)
      const back = rotateAroundAxis(to, axis, radians)
      const n = Math.hypot(...back)
      assert.ok(Math.abs(back[0] / n - 1) < 1e-6, `to=${to} radians=${radians} back=${back}`)
    }
  })
})
