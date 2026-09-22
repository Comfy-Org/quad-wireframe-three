import { unzlibSync } from 'fflate'

export type FbxArrayType = 'b' | 'c' | 'i' | 'l' | 'f' | 'd'

export interface FbxArrayProp {
  readonly kind: 'array'
  readonly type: FbxArrayType
  readonly length: number
  readonly encoding: number
  readonly bytes: Uint8Array
}

export type FbxScalarProp = number | bigint | boolean | string | Uint8Array
export type FbxProp = FbxScalarProp | FbxArrayProp

export interface FbxNode {
  readonly name: string
  readonly props: readonly FbxProp[]
  readonly children: readonly FbxNode[]
}

export interface FbxDocument {
  readonly version: number
  readonly nodes: readonly FbxNode[]
}

export type FbxDecodedArray =
  | Uint8Array
  | Int32Array
  | BigInt64Array
  | Float32Array
  | Float64Array

const MAGIC = 'Kaydara FBX Binary  \0\x1a\0'
const VERSION_OFFSET = MAGIC.length
const FIRST_NODE_OFFSET = VERSION_OFFSET + 4
const ARRAY_TYPES: ReadonlySet<string> = new Set(['b', 'c', 'i', 'l', 'f', 'd'])
const ARRAY_STRIDE: Readonly<Record<FbxArrayType, number>> = {
  b: 1,
  c: 1,
  i: 4,
  l: 8,
  f: 4,
  d: 8
}

const textDecoder = new TextDecoder()

export function isBinaryFbx(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < FIRST_NODE_OFFSET) return false
  const head = new Uint8Array(buffer, 0, MAGIC.length)
  for (let i = 0; i < MAGIC.length; i++) {
    if (head[i] !== MAGIC.charCodeAt(i)) return false
  }
  return true
}

interface Cursor {
  readonly view: DataView
  readonly bytes: Uint8Array
  pos: number
}

interface NodeHeader {
  readonly endOffset: number
  readonly propCount: number
  readonly name: string
}

function readHeader(cursor: Cursor, is64: boolean): NodeHeader {
  const { view } = cursor
  let endOffset: number
  let propCount: number
  if (is64) {
    endOffset = Number(view.getBigUint64(cursor.pos, true))
    propCount = Number(view.getBigUint64(cursor.pos + 8, true))
    cursor.pos += 24
  } else {
    endOffset = view.getUint32(cursor.pos, true)
    propCount = view.getUint32(cursor.pos + 4, true)
    cursor.pos += 12
  }
  const nameLength = view.getUint8(cursor.pos)
  cursor.pos += 1
  const name = textDecoder.decode(
    cursor.bytes.subarray(cursor.pos, cursor.pos + nameLength)
  )
  cursor.pos += nameLength
  return { endOffset, propCount, name }
}

function readBlob(cursor: Cursor): Uint8Array {
  const length = cursor.view.getUint32(cursor.pos, true)
  cursor.pos += 4
  const blob = cursor.bytes.subarray(cursor.pos, cursor.pos + length)
  cursor.pos += length
  return blob
}

function readArrayProp(cursor: Cursor, type: FbxArrayType): FbxArrayProp {
  const { view } = cursor
  const length = view.getUint32(cursor.pos, true)
  const encoding = view.getUint32(cursor.pos + 4, true)
  const byteLength = view.getUint32(cursor.pos + 8, true)
  cursor.pos += 12
  const bytes = cursor.bytes.subarray(cursor.pos, cursor.pos + byteLength)
  cursor.pos += byteLength
  return { kind: 'array', type, length, encoding, bytes }
}

function readProp(cursor: Cursor): FbxProp {
  const { view } = cursor
  const typeCode = String.fromCharCode(view.getUint8(cursor.pos))
  cursor.pos += 1
  if (ARRAY_TYPES.has(typeCode)) {
    return readArrayProp(cursor, typeCode as FbxArrayType)
  }
  switch (typeCode) {
    case 'Y': {
      const value = view.getInt16(cursor.pos, true)
      cursor.pos += 2
      return value
    }
    case 'C': {
      const value = view.getUint8(cursor.pos) !== 0
      cursor.pos += 1
      return value
    }
    case 'I': {
      const value = view.getInt32(cursor.pos, true)
      cursor.pos += 4
      return value
    }
    case 'F': {
      const value = view.getFloat32(cursor.pos, true)
      cursor.pos += 4
      return value
    }
    case 'D': {
      const value = view.getFloat64(cursor.pos, true)
      cursor.pos += 8
      return value
    }
    case 'L': {
      const value = view.getBigInt64(cursor.pos, true)
      cursor.pos += 8
      return value
    }
    case 'R':
      return readBlob(cursor)
    case 'S':
      return textDecoder.decode(readBlob(cursor))
    default:
      throw new Error(
        `Unknown FBX property type '${typeCode}' at byte ${cursor.pos - 1}`
      )
  }
}

function readNode(cursor: Cursor, is64: boolean): FbxNode | null {
  const header = readHeader(cursor, is64)
  if (header.endOffset === 0) return null

  const props: FbxProp[] = []
  for (let i = 0; i < header.propCount; i++) {
    props.push(readProp(cursor))
  }

  const children: FbxNode[] = []
  while (cursor.pos < header.endOffset) {
    const child = readNode(cursor, is64)
    if (child === null) break
    children.push(child)
  }
  cursor.pos = header.endOffset
  return { name: header.name, props, children }
}

export function parseBinaryFbx(buffer: ArrayBuffer): FbxDocument {
  if (!isBinaryFbx(buffer)) {
    throw new Error('Not a binary FBX file (bad magic header)')
  }
  const view = new DataView(buffer)
  const version = view.getUint32(VERSION_OFFSET, true)
  const cursor: Cursor = {
    view,
    bytes: new Uint8Array(buffer),
    pos: FIRST_NODE_OFFSET
  }
  const is64 = version >= 7500

  const nodes: FbxNode[] = []
  while (cursor.pos < buffer.byteLength) {
    const node = readNode(cursor, is64)
    if (node === null) break
    nodes.push(node)
  }
  return { version, nodes }
}

export function decodeArray(prop: FbxArrayProp): FbxDecodedArray {
  const raw = prop.encoding === 1 ? unzlibSync(prop.bytes) : prop.bytes
  const stride = ARRAY_STRIDE[prop.type]
  const expected = prop.length * stride
  if (raw.byteLength < expected) {
    throw new Error(
      `FBX array too short: expected ${expected} bytes, got ${raw.byteLength}`
    )
  }
  const aligned = raw.slice(0, expected)
  switch (prop.type) {
    case 'i':
      return new Int32Array(aligned.buffer)
    case 'l':
      return new BigInt64Array(aligned.buffer)
    case 'f':
      return new Float32Array(aligned.buffer)
    case 'd':
      return new Float64Array(aligned.buffer)
    case 'b':
    case 'c':
      return aligned
  }
}

export function isArrayProp(prop: FbxProp | undefined): prop is FbxArrayProp {
  return (
    typeof prop === 'object' &&
    prop !== null &&
    !(prop instanceof Uint8Array) &&
    prop.kind === 'array'
  )
}

export function findChild(node: FbxNode, name: string): FbxNode | undefined {
  return node.children.find((child) => child.name === name)
}

export function findChildren(node: FbxNode, name: string): FbxNode[] {
  return node.children.filter((child) => child.name === name)
}
