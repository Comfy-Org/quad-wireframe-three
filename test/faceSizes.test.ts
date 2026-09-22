import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { faceSizesFromPolygonVertexIndex, triangleCountOf } from '../src/index.js'

describe('faceSizesFromPolygonVertexIndex', () => {
  const cases: { name: string; input: number[]; expected: number[] }[] = [
    { name: 'empty', input: [], expected: [] },
    { name: 'one triangle', input: [0, 1, ~2], expected: [3] },
    { name: 'one quad', input: [0, 1, 2, ~3], expected: [4] },
    { name: 'mixed sizes', input: [0, 1, ~2, 3, 4, 5, ~6, 0, 1, 2, 3, ~4], expected: [3, 4, 5] },
    { name: 'unterminated tail is dropped', input: [0, 1, ~2, 3, 4], expected: [3] }
  ]
  for (const { name, input, expected } of cases) {
    it(name, () => {
      assert.deepEqual(Array.from(faceSizesFromPolygonVertexIndex(input)), expected)
    })
  }
})

describe('triangleCountOf', () => {
  it('sums n - 2 per polygon and ignores degenerate sizes', () => {
    assert.equal(triangleCountOf([3, 4, 5, 2, 0]), 1 + 2 + 3)
  })
})
