import type { PositionSource } from './types.js'

export interface WeldResult {
  readonly positions: Float32Array
  readonly remap: Uint32Array
}

export function weldPositions(
  source: PositionSource,
  tolerance = 1e-6
): WeldResult {
  const ids = new Map<string, number>()
  const remap = new Uint32Array(source.count)
  const welded: number[] = []
  const inverseTolerance = 1 / tolerance

  for (let i = 0; i < source.count; i++) {
    const x = source.getX(i)
    const y = source.getY(i)
    const z = source.getZ(i)
    const key = `${Math.round(x * inverseTolerance)},${Math.round(
      y * inverseTolerance
    )},${Math.round(z * inverseTolerance)}`
    const existing = ids.get(key)
    if (existing === undefined) {
      remap[i] = ids.size
      ids.set(key, ids.size)
      welded.push(x, y, z)
    } else {
      remap[i] = existing
    }
  }

  return { positions: Float32Array.from(welded), remap }
}
