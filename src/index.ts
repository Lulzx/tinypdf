const WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
]

// Custom error classes
export class TinyPDFError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TinyPDFError'
  }
}

export class ValidationError extends TinyPDFError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ImageError extends TinyPDFError {
  constructor(message: string) {
    super(message)
    this.name = 'ImageError'
  }
}

// Validation helpers
function validateNumber(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${name} must be a finite number, got ${typeof value === 'number' ? value : typeof value}`)
  }
}

function validatePositive(value: number, name: string): void {
  validateNumber(value, name)
  if (value <= 0) {
    throw new ValidationError(`${name} must be positive, got ${value}`)
  }
}

function validateNonNegative(value: number, name: string): void {
  validateNumber(value, name)
  if (value < 0) {
    throw new ValidationError(`${name} must be non-negative, got ${value}`)
  }
}

function validateString(value: string, name: string): void {
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string, got ${typeof value}`)
  }
}

function validateColor(hex: string): void {
  if (hex === 'none') return
  const cleaned = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new ValidationError(`Invalid color format: "${hex}". Use hex format like "#ff0000" or "#f00"`)
  }
}

function validateJPEG(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array)) {
    throw new ImageError('Image data must be a Uint8Array')
  }
  if (bytes.length < 2) {
    throw new ImageError('Image data is too small to be a valid JPEG')
  }
  // Check SOI (Start of Image) marker
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    throw new ImageError('Invalid JPEG: missing SOI marker (0xFFD8). Only JPEG images are supported')
  }
  // Check for EOI (End of Image) marker
  if (bytes[bytes.length - 2] !== 0xFF || bytes[bytes.length - 1] !== 0xD9) {
    throw new ImageError('Invalid JPEG: missing EOI marker (0xFFD9). File may be corrupted')
  }
}

function validateURL(url: string): void {
  validateString(url, 'URL')
  if (url.trim() === '') {
    throw new ValidationError('URL cannot be empty')
  }
  // Basic URL validation - allow common protocols
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
    throw new ValidationError(`Invalid URL: "${url}". URL must start with http://, https://, mailto:, or tel:`)
  }
}

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
    const w = (code >= 32 && code <= 126) ? WIDTHS[code - 32] : 556
    width += w
  }
  return (width * size) / 1000
}

function parseColor(hex: string | undefined): number[] | null {
  if (!hex || hex === 'none') return null
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  return [r, g, b]
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
    if (val.startsWith('/')) return val  // name
    if (val.startsWith('(')) return val  // already escaped string
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
    let width: number
    let height: number
    let fn: (ctx: PageContext) => void

    if (typeof widthOrFn === 'function') {
      width = 612
      height = 792
      fn = widthOrFn
    } else {
      validatePositive(widthOrFn, 'page width')
      if (heightOrUndefined === undefined) {
        throw new ValidationError('page height is required when width is specified')
      }
      validatePositive(heightOrUndefined, 'page height')
      if (typeof fnOrUndefined !== 'function') {
        throw new ValidationError('page callback function is required')
      }
      width = widthOrFn
      height = heightOrUndefined
      fn = fnOrUndefined
    }

    const ops: string[] = []
    const images: { name: string; ref: Ref }[] = []
    const links: { url: string; rect: number[] }[] = []
    let imageCount = 0

    const ctx: PageContext = {
      text(str: string, x: number, y: number, size: number, opts: TextOptions = {}) {
        validateString(str, 'text')
        validateNumber(x, 'x')
        validateNumber(y, 'y')
        validatePositive(size, 'font size')

        const { align = 'left', width: boxWidth, color = '#000000' } = opts
        if (boxWidth !== undefined) validatePositive(boxWidth, 'width')
        validateColor(color)

        let tx = x
        if (align !== 'left' && boxWidth !== undefined) {
          const textWidth = measureText(str, size)
          if (align === 'center') tx = x + (boxWidth - textWidth) / 2
          if (align === 'right') tx = x + boxWidth - textWidth
        }

        const rgb = parseColor(color)
        if (rgb) ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`)
        ops.push('BT')
        ops.push(`/F1 ${size} Tf`)
        ops.push(`${tx.toFixed(2)} ${y.toFixed(2)} Td`)
        ops.push(`${pdfString(str)} Tj`)
        ops.push('ET')
      },

      rect(x: number, y: number, w: number, h: number, fill: string) {
        validateNumber(x, 'x')
        validateNumber(y, 'y')
        validatePositive(w, 'width')
        validatePositive(h, 'height')
        validateColor(fill)

        const rgb = parseColor(fill)
        if (rgb) {
          ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`)
          ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`)
          ops.push('f')
        }
      },

      line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth: number = 1) {
        validateNumber(x1, 'x1')
        validateNumber(y1, 'y1')
        validateNumber(x2, 'x2')
        validateNumber(y2, 'y2')
        validateColor(stroke)
        validatePositive(lineWidth, 'lineWidth')

        const rgb = parseColor(stroke)
        if (rgb) {
          ops.push(`${lineWidth.toFixed(2)} w`)
          ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} RG`)
          ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m`)
          ops.push(`${x2.toFixed(2)} ${y2.toFixed(2)} l`)
          ops.push('S')
        }
      },

      image(jpegBytes: Uint8Array, x: number, y: number, w: number, h: number) {
        validateJPEG(jpegBytes)
        validateNumber(x, 'x')
        validateNumber(y, 'y')
        validatePositive(w, 'width')
        validatePositive(h, 'height')

        let imgWidth = 0, imgHeight = 0
        let foundDimensions = false
        for (let i = 0; i < jpegBytes.length - 1; i++) {
          if (jpegBytes[i] === 0xFF && (jpegBytes[i + 1] === 0xC0 || jpegBytes[i + 1] === 0xC2)) {
            imgHeight = (jpegBytes[i + 5] << 8) | jpegBytes[i + 6]
            imgWidth = (jpegBytes[i + 7] << 8) | jpegBytes[i + 8]
            foundDimensions = true
            break
          }
        }

        if (!foundDimensions || imgWidth === 0 || imgHeight === 0) {
          throw new ImageError('Could not extract image dimensions from JPEG. File may be corrupted')
        }

        const imgName = `/Im${imageCount++}`

        const imgRef = addObject({
          Type: '/XObject',
          Subtype: '/Image',
          Width: imgWidth,
          Height: imgHeight,
          ColorSpace: '/DeviceRGB',
          BitsPerComponent: 8,
          Filter: '/DCTDecode',
          Length: jpegBytes.length
        }, jpegBytes)

        images.push({ name: imgName, ref: imgRef })

        ops.push('q')
        ops.push(`${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`)
        ops.push(`${imgName} Do`)
        ops.push('Q')
      },

      link(url: string, x: number, y: number, w: number, h: number, opts: LinkOptions = {}) {
        validateURL(url)
        validateNumber(x, 'x')
        validateNumber(y, 'y')
        validatePositive(w, 'width')
        validatePositive(h, 'height')
        if (opts.underline) validateColor(opts.underline)

        links.push({ url, rect: [x, y, x + w, y + h] })
        if (opts.underline) {
          const rgb = parseColor(opts.underline)
          if (rgb) {
            ops.push(`0.75 w`)
            ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} RG`)
            ops.push(`${x.toFixed(2)} ${(y + 2).toFixed(2)} m`)
            ops.push(`${(x + w).toFixed(2)} ${(y + 2).toFixed(2)} l`)
            ops.push('S')
          }
        }
      }
    }

    fn(ctx)

    const content = ops.join('\n')
    const contentBytes = new TextEncoder().encode(content)
    const contentRef = addObject({ Length: contentBytes.length }, contentBytes)

    const xobjects: Record<string, Ref> = {}
    for (const img of images) {
      xobjects[img.name.slice(1)] = img.ref
    }

    const annots: Ref[] = links.map(lnk => addObject({
      Type: '/Annot',
      Subtype: '/Link',
      Rect: lnk.rect,
      Border: [0, 0, 0],
      A: { Type: '/Action', S: '/URI', URI: lnk.url }
    }))

    const pageRef = addObject({
      Type: '/Page',
      Parent: null,
      MediaBox: [0, 0, width, height],
      Contents: contentRef,
      Resources: {
        Font: { F1: null },
        XObject: Object.keys(xobjects).length > 0 ? xobjects : undefined
      },
      Annots: annots.length > 0 ? annots : undefined
    })

    pages.push(pageRef)
  }

  function build(): Uint8Array {
    const fontRef = addObject({
      Type: '/Font',
      Subtype: '/Type1',
      BaseFont: '/Helvetica'
    })

    const pagesRef = addObject({
      Type: '/Pages',
      Kids: pages,
      Count: pages.length
    })

    for (const obj of objects) {
      if (obj.dict.Type === '/Page') {
        obj.dict.Parent = pagesRef
        const resources = obj.dict.Resources as Record<string, PDFValue> | undefined
        if (resources?.Font) {
          (resources.Font as Record<string, PDFValue>).F1 = fontRef
        }
      }
    }

    const catalogRef = addObject({
      Type: '/Catalog',
      Pages: pagesRef
    })

    const parts: (string | Uint8Array)[] = []
    const offsets: number[] = []

    parts.push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')

    for (const obj of objects) {
      offsets[obj.id] = parts.reduce((sum, p) => sum + (typeof p === 'string' ? new TextEncoder().encode(p).length : p.length), 0)

      let content = `${obj.id} 0 obj\n${serialize(obj.dict)}\n`
      if (obj.stream) {
        content += 'stream\n'
        parts.push(content)
        parts.push(obj.stream)
        parts.push('\nendstream\nendobj\n')
      } else {
        content += 'endobj\n'
        parts.push(content)
      }
    }

    const xrefOffset = parts.reduce((sum, p) => sum + (typeof p === 'string' ? new TextEncoder().encode(p).length : p.length), 0)

    let xref = `xref\n0 ${objects.length + 1}\n`
    xref += '0000000000 65535 f \n'
    for (let i = 1; i <= objects.length; i++) {
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
    }
    parts.push(xref)

    parts.push(`trailer\n${serialize({ Size: objects.length + 1, Root: catalogRef })}\n`)
    parts.push(`startxref\n${xrefOffset}\n%%EOF\n`)

    const totalLength = parts.reduce((sum, p) => sum + (typeof p === 'string' ? new TextEncoder().encode(p).length : p.length), 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) {
      const bytes = typeof part === 'string' ? new TextEncoder().encode(part) : part
      result.set(bytes, offset)
      offset += bytes.length
    }

    return result
  }

  return { page, build, measureText }
}

export interface MarkdownOptions {
  width?: number
  height?: number
  margin?: number
  images?: Record<string, Uint8Array>
}

function getJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xFF && (bytes[i + 1] === 0xC0 || bytes[i + 1] === 0xC2)) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6]
      const width = (bytes[i + 7] << 8) | bytes[i + 8]
      if (width > 0 && height > 0) return { width, height }
    }
  }
  return null
}

export function markdown(md: string, opts: MarkdownOptions = {}): Uint8Array {
  const W = opts.width ?? 612, H = opts.height ?? 792, M = opts.margin ?? 72
  const images = opts.images ?? {}
  const doc = pdf(), textW = W - M * 2, bodySize = 11

  type TextItem = { type: 'text'; text: string; size: number; indent: number; spaceBefore: number; spaceAfter: number; rule?: boolean; color?: string }
  type ImageItem = { type: 'image'; bytes: Uint8Array; width: number; height: number; spaceBefore: number; spaceAfter: number }
  type Item = TextItem | ImageItem
  const items: Item[] = []

  const wrap = (text: string, size: number, maxW: number): string[] => {
    const words = text.split(' '), lines: string[] = []
    let line = ''
    for (const word of words) {
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

    // Check for image syntax: ![alt](path)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      const path = imgMatch[2]
      const imgBytes = images[path]
      if (imgBytes) {
        const dims = getJpegDimensions(imgBytes)
        if (dims) {
          // Scale to fit within textW while maintaining aspect ratio
          let imgW = dims.width
          let imgH = dims.height
          if (imgW > textW) {
            const scale = textW / imgW
            imgW = textW
            imgH = dims.height * scale
          }
          // Cap max height to avoid oversized images
          const maxH = (H - M * 2) * 0.6
          if (imgH > maxH) {
            const scale = maxH / imgH
            imgH = maxH
            imgW = imgW * scale
          }
          items.push({
            type: 'image',
            bytes: imgBytes,
            width: imgW,
            height: imgH,
            spaceBefore: prevType === 'start' ? 0 : 8,
            spaceAfter: 8
          })
          prevType = 'image'
          continue
        }
      }
      // Image not found, skip silently
      prevType = 'blank'
      continue
    }

    if (/^#{1,3}\s/.test(line)) {
      const lvl = line.match(/^#+/)![0].length
      const size = [22, 16, 13][lvl - 1]
      const before = prevType === 'start' ? 0 : [14, 12, 10][lvl - 1]
      const wrapped = wrap(line.slice(lvl + 1), size, textW)
      wrapped.forEach((l, i) => items.push({ type: 'text', text: l, size, indent: 0, spaceBefore: i === 0 ? before : 0, spaceAfter: 4, color: '#111111' }))
      prevType = 'header'
    } else if (/^[-*]\s/.test(line)) {
      const wrapped = wrap(line.slice(2), bodySize, textW - 18)
      wrapped.forEach((l, i) => items.push({ type: 'text', text: (i === 0 ? '- ' : '  ') + l, size: bodySize, indent: 12, spaceBefore: 0, spaceAfter: 2 }))
      prevType = 'list'
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^\d+/)![0]
      const text = line.slice(num.length + 2)
      const wrapped = wrap(text, bodySize, textW - 18)
      wrapped.forEach((l, i) => items.push({ type: 'text', text: (i === 0 ? num + '. ' : '   ') + l, size: bodySize, indent: 12, spaceBefore: 0, spaceAfter: 2 }))
      prevType = 'list'
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      items.push({ type: 'text', text: '', size: bodySize, indent: 0, spaceBefore: 8, spaceAfter: 8, rule: true })
      prevType = 'rule'
    } else if (line.trim() === '') {
      if (prevType !== 'start' && prevType !== 'blank') items.push({ type: 'text', text: '', size: bodySize, indent: 0, spaceBefore: 0, spaceAfter: 4 })
      prevType = 'blank'
    } else {
      const wrapped = wrap(line, bodySize, textW)
      wrapped.forEach((l, i) => items.push({ type: 'text', text: l, size: bodySize, indent: 0, spaceBefore: 0, spaceAfter: 4, color: '#111111' }))
      prevType = 'para'
    }
  }

  const pages: { items: Item[]; ys: number[] }[] = []
  let y = H - M, pg: Item[] = [], ys: number[] = []
  for (const item of items) {
    const itemHeight = item.type === 'image' ? item.height : item.size
    const needed = item.spaceBefore + itemHeight + item.spaceAfter
    if (y - needed < M) { pages.push({ items: pg, ys }); pg = []; ys = []; y = H - M }
    y -= item.spaceBefore
    ys.push(y); pg.push(item)
    y -= itemHeight + item.spaceAfter
  }
  if (pg.length) pages.push({ items: pg, ys })

  for (const { items: pi, ys: py } of pages) {
    doc.page(W, H, ctx => {
      pi.forEach((it, i) => {
        if (it.type === 'image') {
          // y position is top of image, but ctx.image uses bottom-left
          ctx.image(it.bytes, M, py[i] - it.height, it.width, it.height)
        } else if (it.rule) {
          ctx.line(M, py[i], W - M, py[i], '#e0e0e0', 0.5)
        } else if (it.text) {
          ctx.text(it.text, M + it.indent, py[i], it.size, { color: it.color })
        }
      })
    })
  }
  return doc.build()
}

export default pdf
