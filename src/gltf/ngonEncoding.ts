import { positionAttributeOf } from '../mesh/types.js'
import type { TriangleSource } from '../mesh/types.js'

export const FB_NGON_ENCODING = 'FB_ngon_encoding'

interface GltfExtensionsCarrier {
  readonly userData?: { readonly gltfExtensions?: Record<string, unknown> }
}

export function hasNgonEncoding(object: GltfExtensionsCarrier): boolean {
  return object.userData?.gltfExtensions?.[FB_NGON_ENCODING] !== undefined
}

export function ngonEncodedFaceSizes(geometry: TriangleSource): Uint32Array {
  const index = geometry.index?.array
  const cornerCount = index ? index.length : positionAttributeOf(geometry).count
  const triangleCount = Math.floor(cornerCount / 3)
  const sizes: number[] = []
  let anchor = -1
  for (let t = 0; t < triangleCount; t++) {
    const first = index ? index[t * 3] : t * 3
    if (first === anchor) {
      sizes[sizes.length - 1]++
    } else {
      anchor = first
      sizes.push(3)
    }
  }
  return Uint32Array.from(sizes)
}
