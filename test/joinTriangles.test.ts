import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PlaneGeometry, SphereGeometry } from 'three'
import type { Mesh } from 'three'

import {
  faceCount,
  faceSizesOf,
  joinTriangles,
  polygonEdges,
  polygonMeshFromTriangles,
  readFbxPolygons
} from '../src/index.js'
import type { PolygonMesh } from '../src/index.js'
import {
  QUADBLOB,
  edgeKeySet,
  fixtureBuffer,
  loadFbxMesh,
  loadGlbMesh,
  nearestVertexMap,
  normalisedWorldPositions
} from './helpers.js'

function quadCount(mesh: PolygonMesh): number {
  return faceSizesOf(mesh).filter((size) => size === 4).length
}

function groundTruth(): { mesh: Mesh; polygons: PolygonMesh; edges: Set<number> } {
  const [{ faceSizes }] = readFbxPolygons(fixtureBuffer('quadblob.fbx'))
  const mesh = loadFbxMesh('quadblob.fbx')
  const polygons = polygonMeshFromTriangles(mesh.geometry, faceSizes)
  return { mesh, polygons, edges: edgeKeySet(polygonEdges(polygons)) }
}

function recall(found: Set<number>, truth: Set<number>): number {
  let hits = 0
  for (const key of found) if (truth.has(key)) hits++
  return hits / truth.size
}

function glbEdgesInTruthIds(glb: Mesh, joined: PolygonMesh, truth: ReturnType<typeof groundTruth>) {
  const remap = nearestVertexMap(
    normalisedWorldPositions(glb, joined.positions),
    normalisedWorldPositions(truth.mesh, truth.polygons.positions)
  )
  return edgeKeySet(polygonEdges(joined), remap)
}

describe('joinTriangles', () => {
  it('rebuilds a regular grid exactly', () => {
    const mesh = joinTriangles(polygonMeshFromTriangles(new PlaneGeometry(4, 4, 10, 10)))
    assert.equal(faceCount(mesh), 100)
    assert.equal(quadCount(mesh), 100)
    assert.equal(polygonEdges(mesh).length / 2, 11 * 10 * 2)
  })

  it('recovers the Blender quads from the FBX triangle soup', () => {
    const truth = groundTruth()
    assert.equal(truth.edges.size, QUADBLOB.edges)
    const joined = joinTriangles(polygonMeshFromTriangles(truth.mesh.geometry))
    const score = recall(edgeKeySet(polygonEdges(joined)), truth.edges)
    assert.ok(score >= 0.98, `recall ${score}`)
    assert.ok(quadCount(joined) >= QUADBLOB.faces * 0.9, `quads ${quadCount(joined)}`)
  })

  it('recovers the Blender quads from the triangulated GLB', async () => {
    const glb = await loadGlbMesh('quadblob.glb')
    const soup = polygonMeshFromTriangles(glb.geometry)
    assert.equal(faceCount(soup), QUADBLOB.triangles)
    const joined = joinTriangles(soup)
    const truth = groundTruth()
    const score = recall(glbEdgesInTruthIds(glb, joined, truth), truth.edges)
    assert.ok(score >= 0.98, `recall ${score}`)
    assert.ok(quadCount(joined) >= QUADBLOB.faces * 0.9, `quads ${quadCount(joined)}`)
  })

  it('topology influence recovers at least as many true edges and stays deterministic', () => {
    const truth = groundTruth()
    const soup = polygonMeshFromTriangles(truth.mesh.geometry)
    const plain = recall(edgeKeySet(polygonEdges(joinTriangles(soup, { topologyInfluence: 0 }))), truth.edges)
    const guided = joinTriangles(soup, { topologyInfluence: 2 })
    const guidedAgain = joinTriangles(soup, { topologyInfluence: 2 })
    assert.ok(recall(edgeKeySet(polygonEdges(guided)), truth.edges) >= plain)
    assert.deepEqual(Array.from(guided.faceVertices), Array.from(guidedAgain.faceVertices))
  })

  it('leaves existing quads alone and lets them guide neighbours', () => {
    const grid = joinTriangles(polygonMeshFromTriangles(new PlaneGeometry(2, 2, 2, 2)))
    const mixed = joinTriangles(grid, { topologyInfluence: 1 })
    assert.deepEqual(Array.from(faceSizesOf(mixed)), [4, 4, 4, 4])
  })

  it('respects the shape threshold', () => {
    const sheared = new PlaneGeometry(4, 4, 6, 6)
    const position = sheared.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      position.setX(i, position.getX(i) + position.getY(i) * 1.2)
    }
    const soup = polygonMeshFromTriangles(sheared)
    assert.equal(quadCount(joinTriangles(soup, { shapeAngleThreshold: 0.1 })), 0)
    assert.equal(quadCount(joinTriangles(soup, { shapeAngleThreshold: Math.PI })), 36)
  })

  it('respects the face angle threshold across a sharp crease', () => {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1])
    const crease: PolygonMesh = {
      positions,
      faceOffsets: Uint32Array.from([0, 3, 6]),
      faceVertices: Uint32Array.from([0, 1, 2, 0, 2, 3])
    }
    assert.equal(quadCount(joinTriangles(crease, { faceAngleThreshold: 0.1 })), 0)
    assert.equal(quadCount(joinTriangles(crease, { faceAngleThreshold: Math.PI })), 1)
  })

  it('never joins across a non-manifold edge', () => {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0.5, 0.5, 1])
    const fan: PolygonMesh = {
      positions,
      faceOffsets: Uint32Array.from([0, 3, 6, 9]),
      faceVertices: Uint32Array.from([0, 1, 2, 0, 2, 3, 0, 2, 4])
    }
    assert.equal(quadCount(joinTriangles(fan, { faceAngleThreshold: Math.PI })), 0)
  })

  it('keeps sphere poles as triangles while joining the bands', () => {
    const joined = joinTriangles(polygonMeshFromTriangles(new SphereGeometry(1, 12, 8)))
    const sizes = Array.from(faceSizesOf(joined))
    assert.ok(sizes.includes(3))
    assert.ok(sizes.filter((size) => size === 4).length >= 12 * 6)
  })
})
