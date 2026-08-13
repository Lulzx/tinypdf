import { pdf } from '../src/index'

const doc = pdf()

doc.page(792, 612, p => {
  const forest = '#173f35', gold = '#c59a4b', cream = '#fbf8f0'
  const ink = '#26332f', muted = '#6d7773'

  p.rect(0, 0, 792, 612, cream)
  p.rect(18, 18, 756, 576, forest)
  p.rect(24, 24, 744, 564, cream)
  p.line(38, 38, 754, 38, gold, 1)
  p.line(38, 574, 754, 574, gold, 1)
  p.line(38, 38, 38, 574, gold, 1)
  p.line(754, 38, 754, 574, gold, 1)

  // Geometric corner ornaments
  for (const [x, y, sx, sy] of [[50, 50, 1, 1], [742, 50, -1, 1], [50, 562, 1, -1], [742, 562, -1, -1]] as const) {
    p.line(x, y, x + 46 * sx, y, gold, 2)
    p.line(x, y, x, y + 46 * sy, gold, 2)
    p.line(x + 10 * sx, y + 10 * sy, x + 36 * sx, y + 10 * sy, '#dac395', 0.75)
    p.line(x + 10 * sx, y + 10 * sy, x + 10 * sx, y + 36 * sy, '#dac395', 0.75)
  }

  p.text('AURORA INSTITUTE', 246, 525, 10, { color: forest, align: 'center', width: 300 })
  p.rect(374, 495, 44, 3, gold)
  p.text('CERTIFICATE', 146, 425, 34, { color: forest, align: 'center', width: 500 })
  p.text('OF EXCELLENCE', 146, 389, 15, { color: gold, align: 'center', width: 500 })

  p.text('This distinction is proudly presented to', 196, 333, 11, { color: muted, align: 'center', width: 400 })
  p.text('MAYA BENNETT', 146, 282, 28, { color: ink, align: 'center', width: 500 })
  p.line(224, 267, 568, 267, gold, 0.75)

  p.text('for exceptional craft, clarity, and leadership in', 196, 228, 11, { color: muted, align: 'center', width: 400 })
  p.text('PRODUCT DESIGN', 196, 198, 15, { color: forest, align: 'center', width: 400 })
  p.text('awarded on the eighteenth day of September, 2026', 196, 171, 10, { color: muted, align: 'center', width: 400 })

  // Signatures and seal
  p.line(138, 104, 284, 104, '#9aa29f', 0.75)
  p.text('ELENA PARK', 138, 85, 8, { color: forest, align: 'center', width: 146 })
  p.text('Program Director', 138, 70, 8, { color: muted, align: 'center', width: 146 })

  p.rect(362, 75, 68, 68, gold)
  p.rect(369, 82, 54, 54, forest)
  p.text('AI', 369, 100, 19, { color: cream, align: 'center', width: 54 })

  p.line(508, 104, 654, 104, '#9aa29f', 0.75)
  p.text('JONAS REED', 508, 85, 8, { color: forest, align: 'center', width: 146 })
  p.text('Board Chair', 508, 70, 8, { color: muted, align: 'center', width: 146 })
})

await Bun.write(new URL('./certificate.pdf', import.meta.url).pathname, doc.build())
console.log('Created examples/certificate.pdf')
