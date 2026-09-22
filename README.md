# @comfyorg/quad-wireframe-three

Polygon topology for three.js meshes: draw wireframes that show **quads and n-gons instead of triangulation diagonals**.

three.js only knows triangles. `material.wireframe = true` draws every edge of every triangle, so a quad mesh (retopologised characters, Tripo/Meshy "quad" output, anything from Blender) shows up with a diagonal through each face. `EdgesGeometry` cannot fix it either: on a non-planar quad the diagonal has a dihedral angle just like a real edge. This package restores the polygons and draws only their perimeter.

Two ways in:

| Source                          | Method                                                                                                         | Exactness                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Binary FBX**                  | Read the face sizes straight from `PolygonVertexIndex`, then regroup the triangles three.js `FBXLoader` emits. | Exact (the file has the data).   |
| **glTF with `FB_ngon_encoding`** | Decode the fan-ordered index buffer the extension prescribes (Nomad Sculpt and assimp write it). | Exact (the order is the data). |
| **GLB / OBJ / STL / anything** | Rebuild quads with a port of Blender's *Tris to Quads* (`bmo_join_triangles`), best-first merge on quad quality. | ~98% of the original edges on a noisy retopo mesh. |

The output is a plain `PolygonMesh` (welded positions + face offsets, the same layout Blender uses) and a `BufferGeometry` ready for `THREE.LineSegments`.

## Install

```sh
npm install @comfyorg/quad-wireframe-three three
```

## Usage

### GLB or any triangulated geometry

```ts
import { LineBasicMaterial, LineSegments } from 'three'
import { createQuadWireframeGeometry } from '@comfyorg/quad-wireframe-three'

const wire = new LineSegments(
  createQuadWireframeGeometry(mesh.geometry),
  new LineBasicMaterial({ color: 0xffffff })
)
mesh.add(wire)
```

`createQuadWireframeGeometry` welds the vertices, runs the Blender Tris-to-Quads merge and returns the polygon edges. Tune or disable the merge:

```ts
createQuadWireframeGeometry(geometry, { join: false }) // plain triangle edges
createQuadWireframeGeometry(geometry, {
  join: {
    faceAngleThreshold: (60 * Math.PI) / 180, // Blender "Max Face Angle", default 40°
    shapeAngleThreshold: (60 * Math.PI) / 180, // Blender "Max Shape Angle", default 40°
    topologyInfluence: 2 // Blender "Topology Influence" 0..2, default 1
  }
})
```

### FBX (exact polygons)

```ts
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import {
  createQuadWireframeGeometry,
  matchFbxPolygons,
  readFbxPolygons
} from '@comfyorg/quad-wireframe-three'

const buffer = await (await fetch(url)).arrayBuffer()
const root = new FBXLoader().parse(buffer, '')
const polygons = readFbxPolygons(buffer)

root.traverse((child) => {
  if (!(child as Mesh).isMesh) return
  const mesh = child as Mesh
  const faceSizes = matchFbxPolygons(polygons, mesh.geometry)
  const wire = createQuadWireframeGeometry(mesh.geometry, { faceSizes })
  mesh.add(new LineSegments(wire, material))
})
```

Why a separate reader instead of `FBXLoader`: the loader does parse `PolygonVertexIndex`, but `genFace` earcuts every polygon and only pushes triangle vertices, so the per-face vertex count is never stored anywhere on the output; and its `BinaryParser` and parsed tree are module-private (`FBXLoader.js` exports only `FBXLoader`), so there is no hook to read them either. `readFbxPolygons` is therefore a small binary FBX reader of its own (zlib arrays via `fflate`, the same library `FBXLoader` uses) that stops at `Objects/Geometry/PolygonVertexIndex` and skips textures, animation and everything else; it does not parse ASCII FBX. `matchFbxPolygons` pairs each record with a three.js geometry by the name `FBXLoader` copies onto it, falling back to a unique triangle count, and returns `null` when it cannot be sure — pass `faceSizes: null` and the geometric rebuild runs instead.

### glTF with `FB_ngon_encoding`

glTF itself has no polygons, but the draft [`FB_ngon_encoding`](https://github.com/KhronosGroup/glTF/pull/1620) extension encodes them in the triangle order: each polygon is a fan anchored on one vertex, and consecutive polygons never share their anchor, so a polygon boundary is wherever `triangle.vertex[0]` changes. `GLTFLoader` keeps the index order and records the flag on `mesh.userData.gltfExtensions`:

```ts
import { hasNgonEncoding, ngonEncodedFaceSizes } from '@comfyorg/quad-wireframe-three'

const faceSizes = hasNgonEncoding(mesh) ? ngonEncodedFaceSizes(mesh.geometry) : null
const wire = createQuadWireframeGeometry(mesh.geometry, { faceSizes })
```

Only decode when the flag is present: on an unflagged mesh, neighbouring triangles that happen to share a first index would be merged by mistake. Anything that reorders indices (Draco, meshopt, most optimisers) destroys the encoding and drops the flag with it.

### Lower-level pieces

```ts
import {
  polygonMeshFromTriangles, // BufferGeometry (+ optional faceSizes) → PolygonMesh
  joinTriangles, // Blender Tris to Quads on a PolygonMesh
  polygonEdges, // unique [a, b, a, b, ...] vertex pairs
  createPolygonEdgesGeometry, // PolygonMesh → LineSegments geometry
  faceSizesOf, // per-face vertex counts (3 = tri, 4 = quad, ...)
  weldPositions,
  parseBinaryFbx
} from '@comfyorg/quad-wireframe-three'
```

`faceSizesOf` is also how you get honest *Faces* statistics (Blender's "Faces" rather than a triangle count) for a loaded model.

## Performance

Welding uses a string-keyed map and the merge is `O(E log E)`; both run on the main thread in plain JS. For meshes in the hundreds of thousands of triangles, run `polygonMeshOf` in a worker and transfer the resulting typed arrays.
