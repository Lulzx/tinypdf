const WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
]

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
  measureText: typeof measureText
}

type PDFValue = null | boolean | number | string | PDFValue[] | Ref | { [key: string]: PDFValue | undefined }

interface PDFObject {
  id: number
  dict: Record<string, PDFValue>
  stream: Uint8Array | null
}

export function measureText(str: string, size: number): number {
  let width = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    width += (code >= 32 && code <= 126) ? WIDTHS[code - 32] : 556
  }
  return (width * size) / 1000
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
    if (marker === 0xC0 || marker === 0xC2) {
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
  return '(' + str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n') + ')'
}

function serialize(val: PDFValue): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(4).replace(/\.?0+$/, '')
  if (typeof val === 'string') {
    if (val.startsWith('/')) return val
    if (val.startsWith('(')) return val
    return pdfString(val)
  }
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

  function addObject(dict: Record<string, PDFValue>, streamBytes: Uint8Array | null = null): Ref {
    const id = nextId++
    objects.push({ id, dict, stream: streamBytes })
    return new Ref(id)
  }

  function page(widthOrFn: number | ((ctx: PageContext) => void), heightOrUndefined?: number, fnOrUndefined?: (ctx: PageContext) => void): void {
    let width: number, height: number, fn: (ctx: PageContext) => void
    if (typeof widthOrFn === 'function') { width = 612; height = 792; fn = widthOrFn }
    else { width = widthOrFn; height = heightOrUndefined!; fn = fnOrUndefined! }

    const ops: string[] = []
    const images: { name: string; ref: Ref }[] = []
    const links: { url: string; rect: number[] }[] = []
    let imageCount = 0

    const ctx: PageContext = {
      text(str, x, y, size, opts: TextOptions = {}) {
        const { align = 'left', width: boxWidth, color = '#000000' } = opts
        let tx = x
        if (align !== 'left' && boxWidth !== undefined) {
          const tw = measureText(str, size)
          if (align === 'center') tx = x + (boxWidth - tw) / 2
          if (align === 'right') tx = x + boxWidth - tw
        }
        const c = colorOp(parseColor(color), 'rg') || '0.000 0.000 0.000 rg'
        ops.push(c, 'BT', `/F1 ${size} Tf`, `${tx.toFixed(2)} ${y.toFixed(2)} Td`, `${pdfString(str)} Tj`, 'ET')
      },

      rect(x, y, w, h, fill) {
        const c = colorOp(parseColor(fill), 'rg')
        if (c) {
          ops.push(c, `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`, 'f')
        }
      },

      line(x1, y1, x2, y2, stroke, lineWidth = 1) {
        const c = colorOp(parseColor(stroke), 'RG')
        if (c) {
          ops.push(`${lineWidth.toFixed(2)} w`, c, `${x1.toFixed(2)} ${y1.toFixed(2)} m`, `${x2.toFixed(2)} ${y2.toFixed(2)} l`, 'S')
        }
      },

      image(jpegBytes, x, y, w, h) {
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
      A: { Type: '/Action', S: '/URI', URI: lnk.url }
    }))

    pages.push(addObject({
      Type: '/Page', Parent: null, MediaBox: [0, 0, width, height],
      Contents: contentRef,
      Resources: { Font: { F1: null }, XObject: Object.keys(xobjects).length > 0 ? xobjects : undefined },
      Annots: annots.length > 0 ? annots : undefined
    }))
  }

  let built = false
  function build(): Uint8Array {
    if (!pages.length) throw new Error('PDF must have at least one page')
    if (built) throw new Error('build() can only be called once')
    built = true
    const fontRef = addObject({ Type: '/Font', Subtype: '/Type1', BaseFont: '/Helvetica' })
    const pagesRef = addObject({ Type: '/Pages', Kids: pages, Count: pages.length })

    for (const obj of objects) {
      if (obj.dict.Type === '/Page') {
        obj.dict.Parent = pagesRef
        const resources = obj.dict.Resources as Record<string, PDFValue> | undefined
        if (resources?.Font) (resources.Font as Record<string, PDFValue>).F1 = fontRef
      }
    }

    const catalogRef = addObject({ Type: '/Catalog', Pages: pagesRef })
    const enc = new TextEncoder()
    const chunks: Uint8Array[] = []
    const offsets: number[] = []
    let byteOffset = 0

    const push = (data: string | Uint8Array) => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data
      chunks.push(bytes); byteOffset += bytes.length
    }

    push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')
    for (const obj of objects) {
      offsets[obj.id] = byteOffset
      let head = `${obj.id} 0 obj\n${serialize(obj.dict)}\n`
      if (obj.stream) { push(head + 'stream\n'); push(obj.stream); push('\nendstream\nendobj\n') }
      else push(head + 'endobj\n')
    }

    const xrefOffset = byteOffset
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (let i = 1; i <= objects.length; i++)
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
    push(xref)
    push(`trailer\n${serialize({ Size: objects.length + 1, Root: catalogRef })}\n`)
    push(`startxref\n${xrefOffset}\n%%EOF\n`)

    const result = new Uint8Array(byteOffset)
    let offset = 0
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
    return result
  }

  return { page, build, measureText }
}

export function markdown(md: string, opts: { width?: number; height?: number; margin?: number } = {}): Uint8Array {
  const W = opts.width ?? 612, H = opts.height ?? 792, M = opts.margin ?? 72
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
