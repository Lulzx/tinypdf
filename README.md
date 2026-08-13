# tinypdf

[![npm](https://img.shields.io/npm/v/tinypdf)](https://www.npmjs.com/package/tinypdf)
[![size](https://img.shields.io/bundlephobia/minzip/tinypdf)](https://bundlephobia.com/package/tinypdf)
[![license](https://img.shields.io/npm/l/tinypdf)](LICENSE)

Minimal PDF creation library. **<400 LOC, zero dependencies, makes real PDFs.**

```bash
npm install tinypdf
```

| Executive report | Event ticket |
|---|---|
| [![Executive report](examples/executive-report-v2.png)](examples/executive-report.ts) | [![Event ticket](examples/event-ticket.png)](examples/event-ticket.ts) |
| KPI dashboard and chart | Bold landscape admission ticket |
| Certificate | Invoice |
| [![Certificate](examples/certificate.png)](examples/certificate.ts) | [![Invoice](examples/invoice-v2.png)](examples/invoice.ts) |
| Formal award certificate | Editorial studio invoice |

Run any example with Bun, for example: `bun examples/executive-report.ts`.

---

## Why tinypdf?

|  | tinypdf | jsPDF |
|--|---------|-------|
| **Size** | 3.3 KB | 229 KB |
| **Dependencies** | 0 | 2 |

**~70x smaller.** We removed TTF fonts, PNG/SVG, HTML-to-PDF, forms, encryption, and compression. What's left is the 95% use case: **put text and images on a page.**

### Build with it

Invoices, receipts, reports, shipping labels, tickets, certificates, contracts, data exports

### Features

| Feature | Description |
|---------|-------------|
| **Text** | Helvetica (WinAnsi), any size, hex colors, align left/center/right |
| **Shapes** | Rectangles and lines |
| **Images** | JPEG (photos, logos, signatures) |
| **Links** | Clickable URLs with optional underline |
| **Pages** | Multiple pages, custom sizes |
| **Markdown** | Convert markdown to PDF with headers, lists, rules |

### Not included

Unicode/custom fonts, PNG/GIF/SVG, vector graphics, forms, encryption, compression, HTML-to-PDF

Need those? Use [jsPDF](https://github.com/parallax/jsPDF) or [pdf-lib](https://github.com/Hopding/pdf-lib).

---

## Quick start

```typescript
import { pdf } from 'tinypdf'
import { writeFileSync } from 'fs'

const doc = pdf()

doc.page((ctx) => {
  ctx.rect(50, 700, 200, 40, '#2563eb')           // blue rectangle
  ctx.text('Hello PDF!', 60, 712, 24, { color: '#ffffff' })
  ctx.line(50, 680, 250, 680, '#000000', 1)       // black line
})

writeFileSync('output.pdf', doc.build())
```

### Add images

```typescript
import { readFileSync } from 'fs'

doc.page((ctx) => {
  const logo = new Uint8Array(readFileSync('logo.jpg'))
  ctx.image(logo, 50, 700, 100, 50)
})
```

### Add links

```typescript
import { pdf, measureText } from 'tinypdf'

doc.page((ctx) => {
  const text = 'Visit Example.com'
  const y = 700
  ctx.text(text, 50, y, 14, { color: '#0066cc' })
  ctx.link('https://example.com', 50, y - 4, measureText(text, 14), 18, { underline: '#0066cc' })
})
```

### Measure text width

```typescript
import { measureText } from 'tinypdf'

measureText('Hello', 12) // => 27.34 (points)
```

### Markdown to PDF

```typescript
import { markdown } from 'tinypdf'
import { writeFileSync } from 'fs'

const pdf = markdown(`
# Hello World

A minimal PDF from markdown.

## Features
- Headers (h1, h2, h3)
- Bullet lists
- Numbered lists
- Horizontal rules

---

Automatic word wrapping and pagination included.
`)

writeFileSync('output.pdf', pdf)
```

### Stream large PDFs

Use `buildStream()` to emit a `ReadableStream<Uint8Array>` incrementally. Page content and image inputs are retained until the stream reaches them, but stream bodies are emitted directly and the final PDF is not assembled into one additional full-size buffer.

```typescript
import { pdf } from 'tinypdf'

const doc = pdf()
for (let i = 0; i < 10_000; i++) {
  doc.page((ctx) => ctx.text(`Page ${i + 1}`, 50, 750, 12))
}

// Write to disk (Bun)
await Bun.write('huge.pdf', doc.buildStream())

// Or serve as an HTTP response
return new Response(doc.buildStream(), {
  headers: { 'Content-Type': 'application/pdf' },
})
```

---

## API

```typescript
pdf()                                      // create document
doc.page(callback)                         // add page (612×792 default)
doc.page(width, height, callback)          // add page with custom size
doc.build()                                // returns Uint8Array
doc.buildStream()                          // returns ReadableStream<Uint8Array>

ctx.text(str, x, y, size, options?)        // options: { color, align, width }
ctx.rect(x, y, w, h, fill)                 // filled rectangle
ctx.line(x1, y1, x2, y2, stroke, width?)   // line
ctx.image(jpegBytes, x, y, w, h)           // JPEG image
ctx.link(url, x, y, w, h, options?)        // options: { underline }

measureText(str, size)                     // text width in points
markdown(str, options?)                    // options: { width, height, margin }
```

---

## Full example

See the complete [invoice generator](examples/invoice.ts) for a production-style layout using only tinypdf's core text, rectangle, and line primitives.

---

## License

MIT
