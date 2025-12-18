# tinypdf

Minimal PDF creation library. <400 LOC, zero dependencies, makes real PDFs.

## Installation

```bash
bun add tinypdf
# or
npm install tinypdf
```

## Example

Generate a professional invoice PDF in ~50 lines:

![Invoice Example](examples/invoice.png)

```typescript
import { pdf, measureText } from 'tinypdf'
import { writeFileSync } from 'fs'

const doc = pdf()

doc.page(612, 792, (p) => {
  const margin = 40
  const pw = 612 - margin * 2

  // Header
  p.rect(margin, 716, pw, 36, '#2563eb')
  p.text('INVOICE', margin + 15, 726, 24, { color: '#ffffff' })
  p.text('#INV-2025-001', margin + pw - 100, 728, 12, { color: '#ffffff' })

  // Company info
  p.text('Acme Corporation', margin, 670, 16, { color: '#000000' })
  p.text('123 Business Street', margin, 652, 11, { color: '#666666' })
  p.text('New York, NY 10001', margin, 638, 11, { color: '#666666' })

  // Bill to
  p.text('Bill To:', margin + 300, 670, 12, { color: '#666666' })
  p.text('John Smith', margin + 300, 652, 14, { color: '#000000' })
  p.text('456 Customer Ave', margin + 300, 636, 11, { color: '#666666' })
  p.text('Los Angeles, CA 90001', margin + 300, 622, 11, { color: '#666666' })

  // Table header
  p.rect(margin, 560, pw, 25, '#f3f4f6')
  p.text('Description', margin + 10, 568, 11)
  p.text('Qty', margin + 270, 568, 11)
  p.text('Price', margin + 340, 568, 11)
  p.text('Total', margin + 440, 568, 11)

  // Table rows
  const items = [
    ['Website Development', '1', '$5,000.00', '$5,000.00'],
    ['Hosting (Annual)', '1', '$200.00', '$200.00'],
    ['Maintenance Package', '12', '$150.00', '$1,800.00'],
  ]

  let y = 535
  for (const [desc, qty, price, total] of items) {
    p.text(desc, margin + 10, y, 11)
    p.text(qty, margin + 270, y, 11)
    p.text(price, margin + 340, y, 11)
    p.text(total, margin + 440, y, 11)
    p.line(margin, y - 15, margin + pw, y - 15, '#e5e7eb', 0.5)
    y -= 30
  }

  // Total section
  p.line(margin, y, margin + pw, y, '#000000', 1)
  p.text('Subtotal:', margin + 340, y - 25, 11)
  p.text('$7,000.00', margin + 440, y - 25, 11)
  p.text('Tax (8%):', margin + 340, y - 45, 11)
  p.text('$560.00', margin + 440, y - 45, 11)
  p.rect(margin + 330, y - 75, 202, 25, '#2563eb')
  p.text('Total Due:', margin + 340, y - 63, 12, { color: '#ffffff' })
  p.text('$7,560.00', margin + 440, y - 63, 12, { color: '#ffffff' })

  // Footer
  p.text('Thank you for your business!', margin, 80, 12, { align: 'center', width: pw, color: '#666666' })
  p.text('Payment due within 30 days', margin, 62, 10, { align: 'center', width: pw, color: '#999999' })
})

writeFileSync('invoice.pdf', doc.build())
```

[View sample PDF](examples/invoice.pdf)

## Usage

```typescript
import { pdf } from 'tinypdf'
import { writeFileSync } from 'fs'

const doc = pdf()

// Add a page (default: US Letter 612x792)
doc.page((ctx) => {
  // Draw text
  ctx.text('Hello World!', 50, 700, 24, { color: '#000000' })

  // Draw centered text
  ctx.text('Centered', 50, 650, 16, { align: 'center', width: 200 })

  // Draw a rectangle
  ctx.rect(50, 500, 200, 100, '#3498db')

  // Draw a line
  ctx.line(50, 480, 250, 480, '#e74c3c', 2)
})

// Custom page size
doc.page(400, 600, (ctx) => {
  ctx.text('Custom size page', 50, 550, 18)
})

// Build and save
const bytes = doc.build()
writeFileSync('output.pdf', bytes)
```

### JPEG Images

```typescript
import { readFileSync } from 'fs'

doc.page((ctx) => {
  const jpeg = readFileSync('photo.jpg')
  ctx.image(new Uint8Array(jpeg), 50, 500, 200, 150)
})
```

### Measure Text

```typescript
import { measureText } from 'tinypdf'

const width = measureText('Hello', 12) // width in points
```

## API

### `pdf()`

Creates a new PDF document builder.

### `doc.page([width, height,] callback)`

Adds a page. Default size is US Letter (612x792 points).

### `ctx.text(str, x, y, size, options?)`

Draws text. Options:
- `align`: `'left'` | `'center'` | `'right'`
- `width`: box width for alignment
- `color`: hex color (e.g., `'#ff0000'`)

### `ctx.rect(x, y, width, height, fill)`

Draws a filled rectangle.

### `ctx.line(x1, y1, x2, y2, stroke, lineWidth?)`

Draws a line.

### `ctx.image(jpegBytes, x, y, width, height)`

Draws a JPEG image.

### `doc.build()`

Returns PDF as `Uint8Array`.

### `measureText(str, size)`

Returns text width in points using Helvetica metrics.

## License

MIT
