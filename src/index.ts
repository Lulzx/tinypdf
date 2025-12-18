// tinypdf — Minimal PDF creation library
// <400 LOC, zero dependencies, makes real PDFs

// Helvetica widths, ASCII 32-126, units per 1000
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

export interface PageContext {
  text(str: string, x: number, y: number, size: number, opts?: TextOptions): void
  rect(x: number, y: number, w: number, h: number, fill: string): void
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth?: number): void
  image(jpegBytes: Uint8Array, x: number, y: number, w: number, h: number): void
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

/**
 * Measure text width in points
 * @param str - Text to measure
 * @param size - Font size in points
 * @returns Width in points
 */
export function measureText(str: string, size: number): number {
  let width = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    const w = (code >= 32 && code <= 126) ? WIDTHS[code - 32] : 556
    width += w
  }
  return (width * size) / 1000
}

/**
 * Parse hex color to RGB floats
 * @param hex - Hex color string (#rgb or #rrggbb)
 * @returns RGB values 0-1 or null
 */
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

/**
 * Escape string for PDF
 */
function pdfString(str: string): string {
  return '(' + str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n') + ')'
}

/**
 * Serialize value to PDF format
 */
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

/** PDF object reference */
class Ref {
  id: number
  constructor(id: number) { this.id = id }
}

/**
 * Create a new PDF document
 * @returns PDF builder
 */
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
      width = widthOrFn
      height = heightOrUndefined!
      fn = fnOrUndefined!
    }

    const ops: string[] = []
    const images: { name: string; ref: Ref }[] = []
    let imageCount = 0

    const ctx: PageContext = {
      text(str: string, x: number, y: number, size: number, opts: TextOptions = {}) {
        const { align = 'left', width: boxWidth, color = '#000000' } = opts

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
        const rgb = parseColor(fill)
        if (rgb) {
          ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`)
          ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`)
          ops.push('f')
        }
      },

      line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth: number = 1) {
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
        let imgWidth = 0, imgHeight = 0
        for (let i = 0; i < jpegBytes.length - 1; i++) {
          if (jpegBytes[i] === 0xFF && (jpegBytes[i + 1] === 0xC0 || jpegBytes[i + 1] === 0xC2)) {
            imgHeight = (jpegBytes[i + 5] << 8) | jpegBytes[i + 6]
            imgWidth = (jpegBytes[i + 7] << 8) | jpegBytes[i + 8]
            break
          }
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

    const pageRef = addObject({
      Type: '/Page',
      Parent: null,
      MediaBox: [0, 0, width, height],
      Contents: contentRef,
      Resources: {
        Font: { F1: null },
        XObject: Object.keys(xobjects).length > 0 ? xobjects : undefined
      }
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

export default pdf
