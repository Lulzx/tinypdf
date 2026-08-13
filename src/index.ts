const WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
]

const WIN_ANSI = new Map<number, number>([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
])

export interface TextOptions {
  align?: 'left' | 'center' | 'right'
  width?: number
  color?: string
}

export interface LinkOptions {
  underline?: string
}

export interface PageContext {
  text(str: string, x: number, y: number, size: number, opts?: TextOptions): void
  rect(x: number, y: number, w: number, h: number, fill: string): void
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth?: number): void
  image(jpegBytes: Uint8Array, x: number, y: number, w: number, h: number): void
  link(url: string, x: number, y: number, w: number, h: number, opts?: LinkOptions): void
}

export interface PDFBuilder {
  page(width: number, height: number, fn: (ctx: PageContext) => void): void
  page(fn: (ctx: PageContext) => void): void
  build(): Uint8Array
  buildStream(): ReadableStream<Uint8Array>
  measureText: typeof measureText
}

type PDFValue = null | boolean | number | string | PDFLiteralString | PDFValue[] | Ref | { [key: string]: PDFValue | undefined }

class PDFLiteralString {
  constructor(readonly value: string) {}
}

interface PDFObject {
  id: number
  dict: Record<string, PDFValue | undefined>
  stream: Uint8Array | null
}

export function measureText(str: string, size: number): number {
  assertPositive('Text size', size)
  let width = 0
  for (const ch of str) {
    const byte = winAnsiByte(ch)
    width += (byte >= 32 && byte <= 126) ? WIDTHS[byte - 32] : 556
  }
  return (width * size) / 1000
}

function assertFinite(name: string, ...values: number[]): void {
  if (values.some(value => !Number.isFinite(value)))
    throw new TypeError(`${name} values must be finite numbers`)
}

function assertPositive(name: string, ...values: number[]): void {
  assertFinite(name, ...values)
  if (values.some(value => value <= 0))
    throw new RangeError(`${name} values must be greater than zero`)
}

function winAnsiByte(ch: string): number {
  const code = ch.codePointAt(0)!
  const byte = code <= 0x7F || (code >= 0xA0 && code <= 0xFF) ? code : WIN_ANSI.get(code)
  if (byte === undefined)
    throw new TypeError(`Unsupported character U+${code.toString(16).toUpperCase().padStart(4, '0')}; Helvetica text is limited to WinAnsi`)
  return byte
}

function parseColor(hex: string | undefined): number[] | null {
  if (!hex || hex === 'none') return null
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

function colorOp(rgb: number[] | null, op: string): string {
  return rgb ? `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} ${op}` : ''
}

function parseJpeg(bytes: Uint8Array): { width: number; height: number; colorSpace: string } {
  if (bytes.length < 2 || bytes[0] !== 0xFF || bytes[1] !== 0xD8)
    throw new Error('Invalid JPEG: missing SOI marker')
  let i = 2
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xFF) { i++; continue }
    const marker = bytes[i + 1]
    if (marker === 0xDA) break // SOS — compressed data follows, stop scanning
    const isSof = marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)
    if (isSof) {
      if (i + 9 >= bytes.length) break
      const height = (bytes[i + 5] << 8) | bytes[i + 6]
      const width = (bytes[i + 7] << 8) | bytes[i + 8]
      const c = bytes[i + 9]
      if (width && height)
        return { width, height, colorSpace: c === 1 ? '/DeviceGray' : c === 4 ? '/DeviceCMYK' : '/DeviceRGB' }
    }
    if (i + 3 >= bytes.length) break
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    i += 2 + len
  }
  throw new Error('Invalid JPEG: no valid SOF marker found')
}

function pdfString(str: string): string {
  let result = '('
  for (const ch of str) {
    const byte = winAnsiByte(ch)
    if (byte === 0x5C || byte === 0x28 || byte === 0x29) result += '\\' + String.fromCharCode(byte)
    else if (byte === 0x0D) result += '\\r'
    else if (byte === 0x0A) result += '\\n'
    else if (byte < 0x20 || byte >= 0x7F) result += `\\${byte.toString(8).padStart(3, '0')}`
    else result += String.fromCharCode(byte)
  }
  return result + ')'
}

function serialize(val: PDFValue): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(4).replace(/\.?0+$/, '')
  if (typeof val === 'string') return val
  if (val instanceof PDFLiteralString) return pdfString(val.value)
  if (Array.isArray(val)) return '[' + val.map(serialize).join(' ') + ']'
  if (val instanceof Ref) return `${val.id} 0 R`
  if (typeof val === 'object') {
    const pairs = Object.entries(val)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `/${k} ${serialize(v as PDFValue)}`)
    return '<<\n' + pairs.join('\n') + '\n>>'
  }
  return String(val)
}

class Ref {
  id: number
  constructor(id: number) { this.id = id }
}

export function pdf(): PDFBuilder {
  const objects: PDFObject[] = []
  const pages: Ref[] = []
  let nextId = 1

  function addObject(dict: Record<string, PDFValue | undefined>, streamBytes: Uint8Array | null = null): Ref {
    const id = nextId++
    objects.push({ id, dict, stream: streamBytes })
    return new Ref(id)
  }

  function page(widthOrFn: number | ((ctx: PageContext) => void), heightOrUndefined?: number, fnOrUndefined?: (ctx: PageContext) => void): void {
    let width: number, height: number, fn: (ctx: PageContext) => void
    if (typeof widthOrFn === 'function') { width = 612; height = 792; fn = widthOrFn }
    else { width = widthOrFn; height = heightOrUndefined!; fn = fnOrUndefined! }
    assertPositive('Page dimensions', width, height)
    if (typeof fn !== 'function') throw new TypeError('page() requires a callback')

    const ops: string[] = []
    const images: { name: string; ref: Ref }[] = []
    const links: { url: string; rect: number[] }[] = []
    let imageCount = 0

    const ctx: PageContext = {
      text(str, x, y, size, opts: TextOptions = {}) {
        assertFinite('Text coordinates', x, y)
        assertPositive('Text size', size)
        const { align = 'left', width: boxWidth, color = '#000000' } = opts
        let tx = x
        if (align !== 'left' && boxWidth !== undefined) {
          assertFinite('Text width', boxWidth)
          const tw = measureText(str, size)
          if (align === 'center') tx = x + (boxWidth - tw) / 2
          if (align === 'right') tx = x + boxWidth - tw
        }
        const c = colorOp(parseColor(color), 'rg') || '0.000 0.000 0.000 rg'
        ops.push(c, 'BT', `/F1 ${size} Tf`, `${tx.toFixed(2)} ${y.toFixed(2)} Td`, `${pdfString(str)} Tj`, 'ET')
      },

      rect(x, y, w, h, fill) {
        assertFinite('Rectangle coordinates', x, y)
        assertPositive('Rectangle dimensions', w, h)
        const c = colorOp(parseColor(fill), 'rg')
        if (c) {
          ops.push(c, `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`, 'f')
        }
      },

      line(x1, y1, x2, y2, stroke, lineWidth = 1) {
        assertFinite('Line coordinates', x1, y1, x2, y2)
        assertPositive('Line width', lineWidth)
        const c = colorOp(parseColor(stroke), 'RG')
        if (c) {
          ops.push(`${lineWidth.toFixed(2)} w`, c, `${x1.toFixed(2)} ${y1.toFixed(2)} m`, `${x2.toFixed(2)} ${y2.toFixed(2)} l`, 'S')
        }
      },

      image(jpegBytes, x, y, w, h) {
        assertFinite('Image coordinates', x, y)
        assertPositive('Image dimensions', w, h)
        const { width: imgW, height: imgH, colorSpace } = parseJpeg(jpegBytes)
        const imgName = `/Im${imageCount++}`
        const imgRef = addObject({
          Type: '/XObject', Subtype: '/Image', Width: imgW, Height: imgH,
          ColorSpace: colorSpace, BitsPerComponent: 8, Filter: '/DCTDecode', Length: jpegBytes.length
        }, jpegBytes)
        images.push({ name: imgName, ref: imgRef })
        ops.push('q', `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`, `${imgName} Do`, 'Q')
      },

      link(url, x, y, w, h, opts: LinkOptions = {}) {
        assertFinite('Link coordinates', x, y)
        assertPositive('Link dimensions', w, h)
        links.push({ url, rect: [x, y, x + w, y + h] })
        if (opts.underline) {
          const c = colorOp(parseColor(opts.underline), 'RG')
          if (c) {
            ops.push('0.75 w', c, `${x.toFixed(2)} ${(y + 2).toFixed(2)} m`, `${(x + w).toFixed(2)} ${(y + 2).toFixed(2)} l`, 'S')
          }
        }
      }
    }

    fn(ctx)

    const content = ops.join('\n')
    const contentBytes = new TextEncoder().encode(content)
    const contentRef = addObject({ Length: contentBytes.length }, contentBytes)

    const xobjects: Record<string, Ref> = {}
    for (const img of images) xobjects[img.name.slice(1)] = img.ref

    const annots: Ref[] = links.map(lnk => addObject({
      Type: '/Annot', Subtype: '/Link', Rect: lnk.rect, Border: [0, 0, 0],
      A: { Type: '/Action', S: '/URI', URI: new PDFLiteralString(lnk.url) }
    }))

    pages.push(addObject({
      Type: '/Page', Parent: null, MediaBox: [0, 0, width, height],
      Contents: contentRef,
      Resources: { Font: { F1: null }, XObject: Object.keys(xobjects).length > 0 ? xobjects : undefined },
      Annots: annots.length > 0 ? annots : undefined
    }))
  }

  let built = false

  function finalize(): Ref {
    if (!pages.length) throw new Error('PDF must have at least one page')
    if (built) throw new Error('build() can only be called once')
    built = true
    const fontRef = addObject({ Type: '/Font', Subtype: '/Type1', BaseFont: '/Helvetica', Encoding: '/WinAnsiEncoding' })
    const pagesRef = addObject({ Type: '/Pages', Kids: pages, Count: pages.length })
    for (const obj of objects) {
      if (obj.dict.Type === '/Page') {
        obj.dict.Parent = pagesRef
        const resources = obj.dict.Resources as Record<string, PDFValue> | undefined
        if (resources?.Font) (resources.Font as Record<string, PDFValue>).F1 = fontRef
      }
    }
    return addObject({ Type: '/Catalog', Pages: pagesRef })
  }

  function* emitChunks(catalogRef: Ref): Generator<Uint8Array> {
    const enc = new TextEncoder()
    const offsets: number[] = []
    let byteOffset = 0

    const header = enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')
    byteOffset += header.length; yield header
    for (const obj of objects) {
      offsets[obj.id] = byteOffset
      const head = `${obj.id} 0 obj\n${serialize(obj.dict)}\n`
      if (obj.stream) {
        const a = enc.encode(head + 'stream\n'), b = obj.stream, c = enc.encode('\nendstream\nendobj\n')
        byteOffset += a.length; yield a
        byteOffset += b.length; yield b
        byteOffset += c.length; obj.stream = null; yield c
      } else { const bytes = enc.encode(head + 'endobj\n'); byteOffset += bytes.length; yield bytes }
    }

    const xrefOffset = byteOffset
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (let i = 1; i <= objects.length; i++)
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
    xref += `trailer\n${serialize({ Size: objects.length + 1, Root: catalogRef })}\n`
    xref += `startxref\n${xrefOffset}\n%%EOF\n`
    yield enc.encode(xref)
  }

  function build(): Uint8Array {
    const chunks: Uint8Array[] = []
    let len = 0
    for (const chunk of emitChunks(finalize())) { chunks.push(chunk); len += chunk.length }
    const result = new Uint8Array(len)
    let offset = 0
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
    return result
  }

  function buildStream(): ReadableStream<Uint8Array> {
    const iter = emitChunks(finalize())
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        const { done, value } = iter.next()
        if (done) controller.close()
        else controller.enqueue(value)
      }
    })
  }

  return { page, build, buildStream, measureText }
}

export function markdown(md: string, opts: { width?: number; height?: number; margin?: number } = {}): Uint8Array {
  const W = opts.width ?? 612, H = opts.height ?? 792, M = opts.margin ?? 72
  assertPositive('Page dimensions', W, H)
  assertFinite('Margin', M)
  if (M < 0 || W - M * 2 <= 0 || H - M * 2 <= 0)
    throw new RangeError('Margin must be non-negative and leave usable page space')
  const doc = pdf(), textW = W - M * 2, bodySize = 11
  type Item = { text: string; size: number; indent: number; spaceBefore: number; spaceAfter: number; rule?: boolean; color?: string }
  const items: Item[] = []

  const wrap = (text: string, size: number, maxW: number): string[] => {
    const words = text.split(' '), lines: string[] = []
    let line = ''
    for (const word of words) {
      if (measureText(word, size) > maxW) {
        if (line) { lines.push(line); line = '' }
        let chunk = ''
        for (const ch of word) {
          if (measureText(chunk + ch, size) > maxW && chunk) { lines.push(chunk); chunk = '' }
          chunk += ch
        }
        line = chunk; continue
      }
      const test = line ? line + ' ' + word : word
      if (measureText(test, size) <= maxW) line = test
      else { if (line) lines.push(line); line = word }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  let prevType = 'start'
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (/^#{1,6}\s/.test(line)) {
      const rawLvl = line.match(/^#+/)![0].length
      const lvl = Math.min(rawLvl, 3)
      const size = [22, 16, 13][lvl - 1]
      const before = prevType === 'start' ? 0 : [14, 12, 10][lvl - 1]
      wrap(line.slice(rawLvl + 1), size, textW).forEach((l, i) =>
        items.push({ text: l, size, indent: 0, spaceBefore: i === 0 ? before : 0, spaceAfter: 4, color: '#111111' }))
      prevType = 'header'
    } else if (/^[-*]\s/.test(line)) {
      wrap(line.slice(2), bodySize, textW - 18).forEach((l, i) =>
        items.push({ text: (i === 0 ? '- ' : '  ') + l, size: bodySize, indent: 12, spaceBefore: 0, spaceAfter: 2 }))
      prevType = 'list'
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^\d+/)![0]
      wrap(line.slice(num.length + 2), bodySize, textW - 18).forEach((l, i) =>
        items.push({ text: (i === 0 ? num + '. ' : '   ') + l, size: bodySize, indent: 12, spaceBefore: 0, spaceAfter: 2 }))
      prevType = 'list'
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      items.push({ text: '', size: bodySize, indent: 0, spaceBefore: 8, spaceAfter: 8, rule: true })
      prevType = 'rule'
    } else if (line.trim() === '') {
      if (prevType !== 'start' && prevType !== 'blank')
        items.push({ text: '', size: bodySize, indent: 0, spaceBefore: 0, spaceAfter: 4 })
      prevType = 'blank'
    } else {
      wrap(line, bodySize, textW).forEach((l) =>
        items.push({ text: l, size: bodySize, indent: 0, spaceBefore: 0, spaceAfter: 4, color: '#111111' }))
      prevType = 'para'
    }
  }

  const pages: { items: Item[]; ys: number[] }[] = []
  let y = H - M, pg: Item[] = [], ys: number[] = []
  for (const item of items) {
    const needed = item.spaceBefore + item.size + item.spaceAfter
    if (y - needed < M) { if (pg.length) pages.push({ items: pg, ys }); pg = []; ys = []; y = H - M }
    y -= item.spaceBefore; ys.push(y); pg.push(item); y -= item.size + item.spaceAfter
  }
  if (pg.length) pages.push({ items: pg, ys })
  if (!pages.length) pages.push({ items: [], ys: [] })

  for (const { items: pi, ys: py } of pages) {
    doc.page(W, H, ctx => {
      pi.forEach((it, i) => {
        if (it.rule) ctx.line(M, py[i], W - M, py[i], '#e0e0e0', 0.5)
        else if (it.text) ctx.text(it.text, M + it.indent, py[i], it.size, { color: it.color })
      })
    })
  }
  return doc.build()
}

export default pdf
