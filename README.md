# tinypdf

[![npm](https://img.shields.io/npm/v/tinypdf)](https://www.npmjs.com/package/tinypdf)
[![size](https://img.shields.io/bundlephobia/minzip/tinypdf)](https://bundlephobia.com/package/tinypdf)
[![license](https://img.shields.io/npm/l/tinypdf)](LICENSE)

Minimal PDF creation library. **<400 LOC, zero dependencies, makes real PDFs.**

```bash
npm install tinypdf
```

![Invoice Example](examples/invoice.png)

> [View sample PDF](examples/invoice.pdf) — Generated with ~50 lines of code

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
| **Text** | Helvetica, any size, hex colors, align left/center/right |
| **Shapes** | Rectangles and lines |
| **Images** | JPEG (photos, logos, signatures) |
| **Pages** | Multiple pages, custom sizes |
| **Markdown** | Convert markdown to PDF with headers, lists, rules |

### Not included

Custom fonts, PNG/GIF/SVG, vector graphics, forms, encryption, compression, HTML-to-PDF

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

---

## API

```typescript
pdf()                                      // create document
doc.page(callback)                         // add page (612×792 default)
doc.page(width, height, callback)          // add page with custom size
doc.build()                                // returns Uint8Array

ctx.text(str, x, y, size, options?)        // options: { color, align, width }
ctx.rect(x, y, w, h, fill)                 // filled rectangle
ctx.line(x1, y1, x2, y2, stroke, width?)   // line
ctx.image(jpegBytes, x, y, w, h)           // JPEG image

measureText(str, size)                     // text width in points
markdown(str, options?)                    // options: { width, height, margin }
```

---

## Full example

<details>
<summary>Invoice generator (~50 lines)</summary>

```typescript
import { pdf } from 'tinypdf'
import { writeFileSync } from 'fs'

const doc = pdf()

doc.page(612, 792, (p) => {
  const margin = 40, pw = 532

  // Header
  p.rect(margin, 716, pw, 36, '#2563eb')
  p.text('INVOICE', 55, 726, 24, { color: '#fff' })
  p.text('#INV-2025-001', 472, 728, 12, { color: '#fff' })

  // Company & billing info
  p.text('Acme Corporation', margin, 670, 16)
  p.text('123 Business Street', margin, 652, 11, { color: '#666' })
  p.text('New York, NY 10001', margin, 638, 11, { color: '#666' })

  p.text('Bill To:', 340, 670, 12, { color: '#666' })
  p.text('John Smith', 340, 652, 14)
  p.text('456 Customer Ave', 340, 636, 11, { color: '#666' })
  p.text('Los Angeles, CA 90001', 340, 622, 11, { color: '#666' })

  // Table
  p.rect(margin, 560, pw, 25, '#f3f4f6')
  p.text('Description', 50, 568, 11)
  p.text('Qty', 310, 568, 11)
  p.text('Price', 380, 568, 11)
  p.text('Total', 480, 568, 11)

  const items = [
    ['Website Development', '1', '$5,000.00', '$5,000.00'],
    ['Hosting (Annual)', '1', '$200.00', '$200.00'],
    ['Maintenance Package', '12', '$150.00', '$1,800.00'],
  ]

  let y = 535
  for (const [desc, qty, price, total] of items) {
    p.text(desc, 50, y, 11)
    p.text(qty, 310, y, 11)
    p.text(price, 380, y, 11)
    p.text(total, 480, y, 11)
    p.line(margin, y - 15, margin + pw, y - 15, '#e5e7eb', 0.5)
    y -= 30
  }

  // Totals
  p.line(margin, y, margin + pw, y, '#000', 1)
  p.text('Subtotal:', 380, y - 25, 11)
  p.text('$7,000.00', 480, y - 25, 11)
  p.text('Tax (8%):', 380, y - 45, 11)
  p.text('$560.00', 480, y - 45, 11)
  p.rect(370, y - 75, 202, 25, '#2563eb')
  p.text('Total Due:', 380, y - 63, 12, { color: '#fff' })
  p.text('$7,560.00', 480, y - 63, 12, { color: '#fff' })

  // Footer
  p.text('Thank you for your business!', margin, 80, 12, { align: 'center', width: pw, color: '#666' })
  p.text('Payment due within 30 days', margin, 62, 10, { align: 'center', width: pw, color: '#999' })
})

writeFileSync('invoice.pdf', doc.build())
```

</details>

---

## License

MIT
