import { pdf, measureText } from '../src/index'
import { writeFileSync } from 'fs'

// Create a sample invoice PDF
const doc = pdf()

doc.page(612, 792, (p) => {
  const margin = 40
  const pw = 612 - margin * 2  // page width minus margins = 532

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
  p.text('Description', margin + 10, 568, 11, { color: '#000000' })
  p.text('Qty', margin + 270, 568, 11, { color: '#000000' })
  p.text('Price', margin + 340, 568, 11, { color: '#000000' })
  p.text('Total', margin + 440, 568, 11, { color: '#000000' })

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

const bytes = doc.build()
writeFileSync('examples/invoice.pdf', bytes)

console.log('Created invoice.pdf')
console.log(`File size: ${bytes.length} bytes`)

// Test measureText
console.log(`\nmeasureText test:`)
console.log(`"Hello" at 12pt = ${measureText('Hello', 12).toFixed(2)}pt`)
console.log(`"Hello World" at 24pt = ${measureText('Hello World', 24).toFixed(2)}pt`)
