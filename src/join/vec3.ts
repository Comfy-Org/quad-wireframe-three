export type Vec3 = readonly [number, number, number]

export function vertexAt(positions: Float32Array, index: number): Vec3 {
  const i = index * 3
  return [positions[i], positions[i + 1], positions[i + 2]]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a))
}

export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b))
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a)
  return len > 0 ? scale(a, 1 / len) : [0, 0, 0]
}

export function negate(a: Vec3): Vec3 {
  return [-a[0], -a[1], -a[2]]
}

export function equals(a: Vec3, b: Vec3, epsilon = Number.EPSILON): boolean {
  return (
    Math.abs(a[0] - b[0]) < epsilon &&
    Math.abs(a[1] - b[1]) < epsilon &&
    Math.abs(a[2] - b[2]) < epsilon
  )
}

function safeAsin(x: number): number {
  return Math.asin(Math.min(1, Math.max(-1, x)))
}

export function angleNormalized(a: Vec3, b: Vec3): number {
  if (dot(a, b) >= 0) {
    return 2 * safeAsin(distance(a, b) / 2)
  }
  return Math.PI - 2 * safeAsin(distance(a, negate(b)) / 2)
}

export function angle(a: Vec3, b: Vec3): number {
  return angleNormalized(normalize(a), normalize(b))
}

export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize(cross(sub(b, a), sub(c, a)))
}

export function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
  return length(cross(sub(b, a), sub(c, a))) / 2
}

export function quadNormal(a: Vec3, b: Vec3, c: Vec3, d: Vec3): Vec3 {
  return normalize(cross(sub(a, c), sub(b, d)))
}

export function projectOntoPlane(v: Vec3, unitNormal: Vec3): Vec3 {
  return sub(v, scale(unitNormal, dot(v, unitNormal)))
}

export function angleSignedOnAxis(a: Vec3, b: Vec3, axis: Vec3): number {
  const aProjected = projectOntoPlane(a, axis)
  const bProjected = projectOntoPlane(b, axis)
  const unsigned = angle(aProjected, bProjected)
  const sign = dot(cross(bProjected, aProjected), axis)
  return sign < 0 ? Math.PI * 2 - unsigned : unsigned
}

export function rotateAroundAxis(p: Vec3, axis: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const t = 1 - c
  const [x, y, z] = axis
  return [
    (c + t * x * x) * p[0] + (t * x * y - z * s) * p[1] + (t * x * z + y * s) * p[2],
    (t * x * y + z * s) * p[0] + (c + t * y * y) * p[1] + (t * y * z - x * s) * p[2],
    (t * x * z - y * s) * p[0] + (t * y * z + x * s) * p[1] + (c + t * z * z) * p[2]
  ]
}
