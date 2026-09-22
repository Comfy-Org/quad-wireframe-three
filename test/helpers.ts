import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Box3, Vector3 } from 'three'
import type { Mesh, Object3D } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

export function fixtureBuffer(name: string): ArrayBuffer {
  const bytes = readFileSync(join(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export function firstMesh(root: Object3D): Mesh {
  let found: Mesh | null = null
  root.traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh
  })
  if (!found) throw new Error('fixture has no mesh')
  return found
}

export function loadFbxMesh(name: string): Mesh {
  return firstMesh(new FBXLoader().parse(fixtureBuffer(name), ''))
}

export async function loadGlbMesh(name: string): Promise<Mesh> {
  const gltf = await new GLTFLoader().parseAsync(fixtureBuffer(name), '')
  return firstMesh(gltf.scene)
}

export const QUADBLOB = {
  faces: 384,
  vertices: 386,
  edges: 768,
  triangles: 768
} as const

export function normalisedWorldPositions(mesh: Mesh, positions: Float32Array): Float32Array {
  mesh.updateWorldMatrix(true, false)
  const world = new Float32Array(positions.length)
  const point = new Vector3()
  const bounds = new Box3()
  for (let i = 0; i < positions.length; i += 3) {
    point.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(mesh.matrixWorld)
    world[i] = point.x
    world[i + 1] = point.y
    world[i + 2] = point.z
    bounds.expandByPoint(point)
  }
  const center = bounds.getCenter(new Vector3())
  const extent = bounds.getSize(new Vector3())
  const scale = 1 / Math.max(extent.x, extent.y, extent.z)
  for (let i = 0; i < world.length; i += 3) {
    world[i] = (world[i] - center.x) * scale
    world[i + 1] = (world[i + 1] - center.y) * scale
    world[i + 2] = (world[i + 2] - center.z) * scale
  }
  return world
}

export function nearestVertexMap(from: Float32Array, to: Float32Array): Uint32Array {
  const map = new Uint32Array(from.length / 3)
  for (let i = 0; i < from.length; i += 3) {
    let best = 0
    let bestDistance = Infinity
    for (let j = 0; j < to.length; j += 3) {
      const dx = from[i] - to[j]
      const dy = from[i + 1] - to[j + 1]
      const dz = from[i + 2] - to[j + 2]
      const distance = dx * dx + dy * dy + dz * dz
      if (distance < bestDistance) {
        bestDistance = distance
        best = j / 3
      }
    }
    map[i / 3] = best
  }
  return map
}

export function edgeKeySet(edges: Uint32Array, remap?: Uint32Array): Set<number> {
  const keys = new Set<number>()
  for (let i = 0; i < edges.length; i += 2) {
    const a = remap ? remap[edges[i]] : edges[i]
    const b = remap ? remap[edges[i + 1]] : edges[i + 1]
    keys.add(a < b ? a * 0x100000000 + b : b * 0x100000000 + a)
  }
  return keys
}
