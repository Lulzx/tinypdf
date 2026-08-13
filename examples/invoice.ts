import { pdf } from '../src/index'

const doc = pdf()
const W = 612, H = 792

doc.page(W, H, p => {
  const ink = '#182232', muted = '#6f7887', blue = '#315ee7'
  const mint = '#52d3ac', pale = '#f3f6fa', line = '#dce2eb'
  const margin = 44, contentW = W - margin * 2

  p.rect(0, 0, W, H, '#ffffff')

  // Masthead
  p.rect(0, 696, W, 96, ink)
  p.rect(margin, 744, 24, 4, mint)
  p.text('NORTHSTAR', margin + 34, 736, 11, { color: '#ffffff' })
  p.text('INVOICE', 352, 727, 27, { color: '#ffffff', align: 'right', width: 216 })
  p.text('Creative technology studio', margin, 711, 9, { color: '#aeb8c8' })

  // Identity and invoice metadata
  p.text('BILLED TO', margin, 652, 8, { color: blue })
  p.text('Maya Bennett', margin, 624, 17, { color: ink })
  p.text('Fieldwork Studio', margin, 604, 10, { color: muted })
  p.text('240 Mercer Street', margin, 588, 10, { color: muted })
  p.text('New York, NY 10012', margin, 572, 10, { color: muted })

  p.rect(354, 560, 214, 96, pale)
  const meta = [
    ['INVOICE NO.', 'NS-2048'],
    ['ISSUED', '18 SEP 2026'],
    ['DUE', '18 OCT 2026'],
  ]
  meta.forEach(([label, value], i) => {
    const y = 632 - i * 27
    p.text(label, 370, y, 7, { color: muted })
    p.text(value, 450, y, 9, { color: ink, align: 'right', width: 100 })
  })

  // Line items
  p.text('PROJECT / Q3 PRODUCT LAUNCH', margin, 520, 8, { color: blue })
  p.rect(margin, 478, contentW, 28, ink)
  p.text('DESCRIPTION', margin + 14, 487, 8, { color: '#ffffff' })
  p.text('QTY', 350, 487, 8, { color: '#ffffff' })
  p.text('RATE', 405, 487, 8, { color: '#ffffff' })
  p.text('AMOUNT', 488, 487, 8, { color: '#ffffff' })

  const items = [
    ['Product strategy sprint', '1', '$2,400', '$2,400'],
    ['Interface design system', '1', '$3,850', '$3,850'],
    ['Launch motion toolkit', '1', '$1,200', '$1,200'],
    ['Design QA and handoff', '8h', '$150', '$1,200'],
  ]
  items.forEach(([description, qty, rate, amount], i) => {
    const y = 444 - i * 45
    p.text(description, margin + 14, y, 10, { color: ink })
    p.text(qty, 350, y, 10, { color: muted })
    p.text(rate, 405, y, 10, { color: muted })
    p.text(amount, 478, y, 10, { color: ink, align: 'right', width: 76 })
    p.line(margin, y - 17, margin + contentW, y - 17, line, 0.6)
  })

  // Notes and totals
  p.text('PAYMENT DETAILS', margin, 244, 8, { color: blue })
  p.text('Bank transfer / Northstar Studio LLC', margin, 219, 9, { color: ink })
  p.text('Routing 021000021  /  Account 8841 0920', margin, 202, 9, { color: muted })
  p.text('Please include invoice NS-2048 in the transfer note.', margin, 177, 8, { color: muted })

  p.rect(354, 148, 214, 112, pale)
  p.text('SUBTOTAL', 370, 234, 8, { color: muted })
  p.text('$8,650.00', 458, 234, 9, { color: ink, align: 'right', width: 94 })
  p.text('TAX', 370, 210, 8, { color: muted })
  p.text('$692.00', 458, 210, 9, { color: ink, align: 'right', width: 94 })
  p.rect(354, 148, 214, 42, blue)
  p.text('BALANCE DUE', 370, 164, 9, { color: '#ffffff' })
  p.text('$9,342.00', 450, 160, 16, { color: '#ffffff', align: 'right', width: 102 })

  // Footer
  p.line(margin, 104, margin + contentW, 104, line, 0.75)
  p.text('Thank you for building with us.', margin, 74, 11, { color: ink })
  p.text('hello@northstar.design  /  northstar.design', margin, 55, 8, { color: muted })
  p.text('01 / 01', 508, 55, 8, { color: '#98a2b1', align: 'right', width: 60 })
})

await Bun.write(new URL('./invoice.pdf', import.meta.url).pathname, doc.build())
console.log('Created examples/invoice.pdf')
