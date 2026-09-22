import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { joinTriangles, polygonMeshFromFaces } from '../src/index.js'
import type { JoinTrianglesOptions, PolygonMesh } from '../src/index.js'

interface OracleRun extends Required<JoinTrianglesOptions> {
  faces: number[][]
}

interface OracleCase {
  name: string
  vertices: number[][]
  faces: number[][]
  runs: OracleRun[]
}

const oracle = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'blender-oracle.json'),
    'utf-8'
  )
) as { blender: string; cases: OracleCase[] }

function canonicalFaces(faces: Iterable<ArrayLike<number>>): Set<string> {
  const keys = new Set<string>()
  for (const face of faces) {
    keys.add(
      Array.from(face)
        .sort((a, b) => a - b)
        .join('-')
    )
  }
  return keys
}

function facesOf(mesh: PolygonMesh): number[][] {
  const faces: number[][] = []
  for (let f = 0; f + 1 < mesh.faceOffsets.length; f++) {
    faces.push(
      Array.from(mesh.faceVertices.subarray(mesh.faceOffsets[f], mesh.faceOffsets[f + 1]))
    )
  }
  return faces
}

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI)

describe(`joinTriangles matches Blender ${oracle.blender} join_triangles`, () => {
  for (const testCase of oracle.cases) {
    const source = polygonMeshFromFaces(
      Float32Array.from(testCase.vertices.flat()),
      testCase.faces
    )
    for (const run of testCase.runs) {
      const label = `${testCase.name}: face ${degrees(run.faceAngleThreshold)}°, shape ${degrees(run.shapeAngleThreshold)}°, topology ${run.topologyInfluence}`
      it(label, () => {
        const mine = canonicalFaces(facesOf(joinTriangles(source, run)))
        const blender = canonicalFaces(run.faces)
        const onlyMine = [...mine].filter((key) => !blender.has(key))
        const onlyBlender = [...blender].filter((key) => !mine.has(key))
        assert.deepEqual(
          { onlyMine, onlyBlender },
          { onlyMine: [], onlyBlender: [] },
          `${mine.size} faces vs Blender ${blender.size}`
        )
      })
    }
  }
})
