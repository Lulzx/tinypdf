import { describe, expect, test } from 'bun:test'
import { pdf, measureText, markdown } from './index'

describe('pdf', () => {
  test('creates a valid PDF with header', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes.slice(0, 8))
    expect(str).toBe('%PDF-1.4')
  })

  test('creates a valid PDF with trailer', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('%%EOF')
  })

  test('returns Uint8Array', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  test('creates non-empty PDF', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    expect(bytes.length).toBeGreaterThan(0)
  })
})

describe('page', () => {
  test('uses default page size (612x792)', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/MediaBox [0 0 612 792]')
  })

  test('accepts custom page size', () => {
    const doc = pdf()
    doc.page(400, 600, () => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/MediaBox [0 0 400 600]')
  })

  test('supports multiple pages', () => {
    const doc = pdf()
    doc.page(() => {})
    doc.page(() => {})
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Count 3')
  })

  test('callback receives context object', () => {
    const doc = pdf()
    let ctx: any = null
    doc.page((c) => { ctx = c })
    doc.build()
    expect(ctx).not.toBeNull()
    expect(typeof ctx.text).toBe('function')
    expect(typeof ctx.rect).toBe('function')
    expect(typeof ctx.line).toBe('function')
    expect(typeof ctx.image).toBe('function')
    expect(typeof ctx.link).toBe('function')
  })
})

describe('text', () => {
  test('renders text with Tj operator', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Hello', 50, 700, 12)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Hello) Tj')
  })

  test('sets font size', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Test', 50, 700, 24)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/F1 24 Tf')
  })

  test('sets text position', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Test', 100, 500, 12)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('100.00 500.00 Td')
  })

  test('applies color', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Red', 50, 700, 12, { color: '#ff0000' })
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('1.000 0.000 0.000 rg')
  })

  test('escapes special characters', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Hello (world)', 50, 700, 12)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Hello \\(world\\)) Tj')
  })

  test('escapes backslashes', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('path\\to\\file', 50, 700, 12)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(path\\\\to\\\\file) Tj')
  })
})

describe('text alignment', () => {
  test('left alignment is default', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Left', 50, 700, 12)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('50.00 700.00 Td')
  })

  test('center alignment shifts x position', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Hi', 50, 700, 12, { align: 'center', width: 100 })
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    // "Hi" at 12pt ≈ 12.67pt wide, centered in 100pt box
    // x = 50 + (100 - 12.67) / 2 ≈ 93.67
    expect(str).not.toContain('50.00 700.00 Td')
  })

  test('right alignment shifts x position', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.text('Hi', 50, 700, 12, { align: 'right', width: 100 })
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).not.toContain('50.00 700.00 Td')
  })
})

describe('rect', () => {
  test('renders rectangle with re operator', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(50, 700, 200, 100, '#0000ff')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('50.00 700.00 200.00 100.00 re')
  })

  test('fills rectangle', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(50, 700, 200, 100, '#ff0000')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('f')
  })

  test('applies fill color', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(50, 700, 200, 100, '#00ff00')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('0.000 1.000 0.000 rg')
  })

  test('handles 3-char hex colors', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(50, 700, 200, 100, '#f00')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('1.000 0.000 0.000 rg')
  })
})

describe('line', () => {
  test('renders line with m and l operators', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.line(50, 700, 250, 700, '#000000')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('50.00 700.00 m')
    expect(str).toContain('250.00 700.00 l')
  })

  test('strokes line', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.line(50, 700, 250, 700, '#000000')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('S')
  })

  test('sets stroke color', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.line(50, 700, 250, 700, '#ff0000')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('1.000 0.000 0.000 RG')
  })

  test('sets line width', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.line(50, 700, 250, 700, '#000000', 2.5)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('2.50 w')
  })

  test('uses default line width of 1', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.line(50, 700, 250, 700, '#000000')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('1.00 w')
  })
})

describe('link', () => {
  test('creates link annotation', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Type /Annot')
    expect(str).toContain('/Subtype /Link')
  })

  test('sets URI action', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/S /URI')
    expect(str).toContain('/URI (https://example.com)')
  })

  test('sets link rect', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Rect [50 700 150 720]')
  })

  test('has invisible border by default', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Border [0 0 0]')
  })

  test('draws underline when specified', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20, { underline: '#0000ff' })
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('0.000 0.000 1.000 RG')
    expect(str).toContain('50.00 702.00 m')
    expect(str).toContain('150.00 702.00 l')
    expect(str).toContain('S')
  })

  test('no underline without option', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).not.toContain('50.00 702.00 m')
  })

  test('adds Annots to page', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Annots')
  })

  test('multiple links on same page', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.link('https://example.com', 50, 700, 100, 20)
      ctx.link('https://github.com', 50, 650, 100, 20)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/URI (https://example.com)')
    expect(str).toContain('/URI (https://github.com)')
  })
})

describe('image validation', () => {
  test('throws for non-JPEG data', () => {
    const doc = pdf()
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47]) // PNG header
    doc.page((ctx) => {
      expect(() => ctx.image(png, 0, 0, 100, 100)).toThrow('missing SOI marker')
    })
    doc.build()
  })

  test('throws for empty data', () => {
    const doc = pdf()
    doc.page((ctx) => {
      expect(() => ctx.image(new Uint8Array([]), 0, 0, 100, 100)).toThrow('missing SOI marker')
    })
    doc.build()
  })

  test('throws for JPEG with no SOF marker', () => {
    const doc = pdf()
    // Valid SOI but no SOF marker following
    const noSof = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x02, 0x00, 0x00])
    doc.page((ctx) => {
      expect(() => ctx.image(noSof, 0, 0, 100, 100)).toThrow('no valid SOF marker')
    })
    doc.build()
  })

  test('throws when SOF marker is truncated near end of buffer', () => {
    const doc = pdf()
    // SOI + SOF marker at very end, not enough bytes for dimensions
    const truncated = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0x00])
    doc.page((ctx) => {
      expect(() => ctx.image(truncated, 0, 0, 100, 100)).toThrow('no valid SOF marker')
    })
    doc.build()
  })

  test('uses DeviceGray for 1-component JPEG', () => {
    // Build a minimal JPEG with SOI + SOF0 having 1 component
    const gray = new Uint8Array([
      0xFF, 0xD8,                                           // SOI
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, // SOF: 1x1, 1 component
      0x01, 0x11, 0x00
    ])
    const doc = pdf()
    doc.page((ctx) => { ctx.image(gray, 0, 0, 50, 50) })
    const str = new TextDecoder().decode(doc.build())
    expect(str).toContain('/ColorSpace /DeviceGray')
  })

  test('uses DeviceCMYK for 4-component JPEG', () => {
    const cmyk = new Uint8Array([
      0xFF, 0xD8,                                           // SOI
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x04, // SOF: 1x1, 4 components
      0x01, 0x11, 0x00
    ])
    const doc = pdf()
    doc.page((ctx) => { ctx.image(cmyk, 0, 0, 50, 50) })
    const str = new TextDecoder().decode(doc.build())
    expect(str).toContain('/ColorSpace /DeviceCMYK')
  })
})

describe('image', () => {
  // Minimal valid JPEG (1x1 red pixel)
  const minimalJpeg = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xDA,
    0xF5, 0x1D, 0x65, 0xFC, 0xB6, 0x33, 0x0C, 0x24, 0x6E, 0xF9, 0x3D, 0xFC,
    0xF1, 0x44, 0x7F, 0xFF, 0xD9
  ])

  test('creates image XObject', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.image(minimalJpeg, 50, 700, 100, 100)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Type /XObject')
    expect(str).toContain('/Subtype /Image')
  })

  test('sets DCTDecode filter for JPEG', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.image(minimalJpeg, 50, 700, 100, 100)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Filter /DCTDecode')
  })

  test('uses Do operator to draw image', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.image(minimalJpeg, 50, 700, 100, 100)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Im0 Do')
  })

  test('applies transformation matrix', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.image(minimalJpeg, 50, 700, 100, 80)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('100.00 0 0 80.00 50.00 700.00 cm')
  })

  test('wraps image in q/Q graphics state', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.image(minimalJpeg, 50, 700, 100, 100)
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('q')
    expect(str).toContain('Q')
  })
})

describe('measureText', () => {
  test('returns number', () => {
    const width = measureText('Hello', 12)
    expect(typeof width).toBe('number')
  })

  test('returns 0 for empty string', () => {
    const width = measureText('', 12)
    expect(width).toBe(0)
  })

  test('scales with font size', () => {
    const width12 = measureText('Hello', 12)
    const width24 = measureText('Hello', 24)
    expect(width24).toBeCloseTo(width12 * 2, 5)
  })

  test('increases with more characters', () => {
    const short = measureText('Hi', 12)
    const long = measureText('Hello World', 12)
    expect(long).toBeGreaterThan(short)
  })

  test('handles space character', () => {
    const withSpace = measureText('a b', 12)
    const withoutSpace = measureText('ab', 12)
    expect(withSpace).toBeGreaterThan(withoutSpace)
  })

  test('uses fallback width for non-ASCII', () => {
    const ascii = measureText('a', 12)
    const nonAscii = measureText('中', 12)
    // Non-ASCII uses fallback width of 556 units
    expect(nonAscii).toBeCloseTo(556 * 12 / 1000, 5)
  })

  test('returns expected width for known string', () => {
    // "Hello" = H(722) + e(556) + l(222) + l(222) + o(556) = 2278 units
    // At 12pt: 2278 * 12 / 1000 = 27.336
    const width = measureText('Hello', 12)
    expect(width).toBeCloseTo(27.336, 2)
  })
})

describe('PDF structure', () => {
  test('contains catalog', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Type /Catalog')
  })

  test('contains pages object', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Type /Pages')
  })

  test('contains page object', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/Type /Page')
  })

  test('contains Helvetica font', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/BaseFont /Helvetica')
  })

  test('contains xref table', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('xref')
  })

  test('contains trailer', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('trailer')
  })

  test('contains startxref', () => {
    const doc = pdf()
    doc.page(() => {})
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('startxref')
  })
})

describe('color parsing', () => {
  test('parses 6-char hex', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(0, 0, 100, 100, '#aabbcc')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    // aa=170, bb=187, cc=204 -> 170/255≈0.667, 187/255≈0.733, 204/255=0.8
    expect(str).toContain('0.667 0.733 0.800 rg')
  })

  test('parses 3-char hex', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(0, 0, 100, 100, '#abc')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    // #abc = #aabbcc
    expect(str).toContain('0.667 0.733 0.800 rg')
  })

  test('handles hash prefix', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(0, 0, 100, 100, '#ff0000')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('1.000 0.000 0.000 rg')
  })

  test('ignores invalid hex color', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(0, 0, 100, 100, 'xyz')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).not.toContain('NaN')
    expect(str).not.toContain(' re')
  })

  test('ignores invalid 6-char non-hex color', () => {
    const doc = pdf()
    doc.page((ctx) => {
      ctx.rect(0, 0, 100, 100, '#gggggg')
    })
    const bytes = doc.build()
    const str = new TextDecoder().decode(bytes)
    expect(str).not.toContain('NaN')
    expect(str).not.toContain(' re')
  })
})

describe('markdown', () => {
  test('creates valid PDF', () => {
    const bytes = markdown('# Hello')
    const str = new TextDecoder().decode(bytes.slice(0, 8))
    expect(str).toBe('%PDF-1.4')
  })

  test('returns Uint8Array', () => {
    const bytes = markdown('Hello')
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  test('renders h1 header', () => {
    const bytes = markdown('# Title')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Title) Tj')
    expect(str).toContain('/F1 22 Tf')
  })

  test('renders h2 header', () => {
    const bytes = markdown('## Subtitle')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Subtitle) Tj')
    expect(str).toContain('/F1 16 Tf')
  })

  test('renders h3 header', () => {
    const bytes = markdown('### Section')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Section) Tj')
    expect(str).toContain('/F1 13 Tf')
  })

  test('renders h4 heading as h3 size', () => {
    const bytes = markdown('#### Subsection')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Subsection) Tj')
    expect(str).toContain('/F1 13 Tf')
    expect(str).not.toContain('NaN')
  })

  test('renders h5 heading without NaN', () => {
    const bytes = markdown('##### Deep')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Deep) Tj')
    expect(str).toContain('/F1 13 Tf')
  })

  test('renders h6 heading without NaN', () => {
    const bytes = markdown('###### Deepest')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(Deepest) Tj')
    expect(str).toContain('/F1 13 Tf')
  })

  test('renders bullet list with dash', () => {
    const bytes = markdown('- Item one')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('Item one')
  })

  test('renders bullet list with asterisk', () => {
    const bytes = markdown('* Item two')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('Item two')
  })

  test('renders numbered list', () => {
    const bytes = markdown('1. First item')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('1.')
    expect(str).toContain('First item')
  })

  test('renders horizontal rule', () => {
    const bytes = markdown('---')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('l')
    expect(str).toContain('S')
  })

  test('renders paragraph text', () => {
    const bytes = markdown('This is a paragraph.')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('(This is a paragraph.) Tj')
  })

  test('uses default page size', () => {
    const bytes = markdown('Hello')
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/MediaBox [0 0 612 792]')
  })

  test('accepts custom page size', () => {
    const bytes = markdown('Hello', { width: 400, height: 600 })
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('/MediaBox [0 0 400 600]')
  })

  test('creates multiple pages for long content', () => {
    const lines = Array(100).fill('This is a line of text.').join('\n')
    const bytes = markdown(lines)
    const str = new TextDecoder().decode(bytes)
    const pageCount = (str.match(/\/Type \/Page\b/g) || []).length
    expect(pageCount).toBeGreaterThan(1)
  })

  test('wraps long lines', () => {
    const longLine = 'word '.repeat(50)
    const bytes = markdown(longLine)
    const str = new TextDecoder().decode(bytes)
    const tjCount = (str.match(/\) Tj/g) || []).length
    expect(tjCount).toBeGreaterThan(1)
  })

  test('handles empty input', () => {
    const bytes = markdown('')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  test('handles mixed content', () => {
    const md = `# Header

Some paragraph text.

- Bullet one
- Bullet two

1. Number one
2. Number two

---

More text.`
    const bytes = markdown(md)
    const str = new TextDecoder().decode(bytes)
    expect(str).toContain('Header')
    expect(str).toContain('paragraph')
    expect(str).toContain('Bullet')
    expect(str).toContain('Number')
  })
})
