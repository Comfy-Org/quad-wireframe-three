import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IndexedMinHeap } from '../src/join/heap.js'

describe('IndexedMinHeap', () => {
  it('pops ids in ascending key order', () => {
    const heap = new IndexedMinHeap(8)
    const keys = [5, 3, 8, 1, 9, 2, 7, 4]
    keys.forEach((key, id) => heap.push(id, key))
    const popped: number[] = []
    while (heap.size > 0) popped.push(heap.keyOf(heap.pop()))
    assert.deepEqual(popped, [...keys].sort((a, b) => a - b))
  })

  it('reorders after keys move up or down', () => {
    const heap = new IndexedMinHeap(4)
    heap.push(0, 10)
    heap.push(1, 20)
    heap.push(2, 30)
    heap.update(2, 5)
    assert.equal(heap.peekKey(), 5)
    heap.update(2, 25)
    assert.equal(heap.pop(), 0)
    assert.equal(heap.pop(), 1)
    assert.equal(heap.pop(), 2)
  })

  it('tracks membership', () => {
    const heap = new IndexedMinHeap(2)
    assert.equal(heap.has(1), false)
    heap.push(1, 1)
    assert.equal(heap.has(1), true)
    heap.pop()
    assert.equal(heap.has(1), false)
    assert.equal(heap.size, 0)
  })
})
