import {
  angleNormalized,
  cross,
  dot,
  equals,
  normalize,
  sub,
  triangleArea,
  triangleNormal
} from './vec3.js'
import type { Vec3 } from './vec3.js'

const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2

function normalDifference(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const n1 = triangleNormal(a, b, c)
  const n2 = triangleNormal(a, c, d)
  const angleA = equals(n1, n2) ? 0 : angleNormalized(n1, n2)
  const n3 = triangleNormal(b, c, d)
  const n4 = triangleNormal(d, a, b)
  const angleB = equals(n3, n4) ? 0 : angleNormalized(n3, n4)
  return (angleA + angleB) / TWO_PI
}

export function quadEdgeDirections(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3
): readonly [Vec3, Vec3, Vec3, Vec3] {
  return [
    normalize(sub(a, b)),
    normalize(sub(b, c)),
    normalize(sub(c, d)),
    normalize(sub(d, a))
  ]
}

export function cornerAngleDeviations(
  edges: readonly [Vec3, Vec3, Vec3, Vec3]
): readonly [number, number, number, number] {
  return [
    Math.abs(angleNormalized(edges[0], edges[1]) - HALF_PI),
    Math.abs(angleNormalized(edges[1], edges[2]) - HALF_PI),
    Math.abs(angleNormalized(edges[2], edges[3]) - HALF_PI),
    Math.abs(angleNormalized(edges[3], edges[0]) - HALF_PI)
  ]
}

function colinearity(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const deviations = cornerAngleDeviations(quadEdgeDirections(a, b, c, d))
  return (deviations[0] + deviations[1] + deviations[2] + deviations[3]) / TWO_PI
}

function concavity(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const areaA = triangleArea(a, b, c) + triangleArea(a, c, d)
  const areaB = triangleArea(b, c, d) + triangleArea(d, a, b)
  const min = Math.min(areaA, areaB)
  const max = Math.max(areaA, areaB)
  return max > 0 ? 1 - min / max : 1
}

export function quadError(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  return normalDifference(a, b, c, d) + colinearity(a, b, c, d) + concavity(a, b, c, d)
}

export function isQuadFlipped(a: Vec3, b: Vec3, c: Vec3, d: Vec3): boolean {
  const ab = sub(a, b)
  const bc = sub(b, c)
  const cd = sub(c, d)
  const da = sub(d, a)
  const firstFold = dot(cross(ab, bc), cross(cd, da)) < 0
  const secondFold = dot(cross(bc, cd), cross(da, ab)) < 0
  return firstFold || secondFold
}
