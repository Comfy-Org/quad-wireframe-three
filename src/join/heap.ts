export class IndexedMinHeap {
  private readonly ids: number[] = []
  private readonly slotOf: Int32Array
  private readonly keys: Float64Array

  constructor(capacity: number) {
    this.slotOf = new Int32Array(capacity).fill(-1)
    this.keys = new Float64Array(capacity)
  }

  get size(): number {
    return this.ids.length
  }

  has(id: number): boolean {
    return this.slotOf[id] >= 0
  }

  keyOf(id: number): number {
    return this.keys[id]
  }

  peekKey(): number {
    return this.keys[this.ids[0]]
  }

  push(id: number, key: number): void {
    this.keys[id] = key
    this.slotOf[id] = this.ids.length
    this.ids.push(id)
    this.siftUp(this.ids.length - 1)
  }

  pop(): number {
    const top = this.ids[0]
    const last = this.ids.pop() as number
    this.slotOf[top] = -1
    if (this.ids.length > 0) {
      this.ids[0] = last
      this.slotOf[last] = 0
      this.siftDown(0)
    }
    return top
  }

  update(id: number, key: number): void {
    const previous = this.keys[id]
    this.keys[id] = key
    const slot = this.slotOf[id]
    if (key < previous) this.siftUp(slot)
    else this.siftDown(slot)
  }

  private swap(a: number, b: number): void {
    const idA = this.ids[a]
    const idB = this.ids[b]
    this.ids[a] = idB
    this.ids[b] = idA
    this.slotOf[idB] = a
    this.slotOf[idA] = b
  }

  private siftUp(slot: number): void {
    while (slot > 0) {
      const parent = (slot - 1) >> 1
      if (this.keys[this.ids[parent]] <= this.keys[this.ids[slot]]) return
      this.swap(slot, parent)
      slot = parent
    }
  }

  private siftDown(slot: number): void {
    const count = this.ids.length
    for (;;) {
      const left = slot * 2 + 1
      const right = left + 1
      let smallest = slot
      if (left < count && this.keys[this.ids[left]] < this.keys[this.ids[smallest]]) {
        smallest = left
      }
      if (right < count && this.keys[this.ids[right]] < this.keys[this.ids[smallest]]) {
        smallest = right
      }
      if (smallest === slot) return
      this.swap(slot, smallest)
      slot = smallest
    }
  }
}
