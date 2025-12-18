# tinypdf

Minimal PDF creation library. <400 LOC, zero dependencies, makes real PDFs.

## Installation

```bash
bun add tinypdf
# or
npm install tinypdf
```

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
