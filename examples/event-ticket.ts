import { pdf } from '../src/index'

const doc = pdf()

doc.page(720, 320, p => {
  const night = '#10131c', violet = '#7757ff', coral = '#ff6b6b'
  const paper = '#f7f4ed', muted = '#777b86'

  p.rect(0, 0, 720, 320, night)
  p.rect(18, 18, 684, 284, paper)

  // Bold poster panel
  p.rect(18, 18, 260, 284, violet)
  p.rect(18, 18, 260, 8, coral)
  p.text('AFTER', 42, 220, 38, { color: '#ffffff' })
  p.text('DARK', 42, 177, 38, { color: '#ffffff' })
  p.line(42, 150, 232, 150, '#a99aff', 1)
  p.text('DESIGN + SOUND', 42, 126, 9, { color: '#ddd7ff' })
  p.text('ONE NIGHT IN BROOKLYN', 42, 108, 9, { color: '#ddd7ff' })
  p.text('LIVE / LIMITED / LOUD', 42, 49, 8, { color: '#c8bdff' })

  // Event details
  p.text('FRIDAY', 316, 258, 9, { color: coral })
  p.text('18 SEPTEMBER 2026', 316, 230, 20, { color: night })
  p.text('Doors 8:00 PM / Show 9:30 PM', 316, 207, 10, { color: muted })

  p.line(316, 181, 666, 181, '#d9d5ce', 0.75)
  p.text('THE FOUNDRY', 316, 151, 13, { color: night })
  p.text('74 Wythe Avenue, Brooklyn', 316, 132, 9, { color: muted })

  const details = [
    ['ADMIT', 'ONE'],
    ['SECTION', 'FLOOR'],
    ['ENTRY', 'A-07'],
  ]
  details.forEach(([label, value], i) => {
    const x = 316 + i * 116
    p.text(label, x, 91, 7, { color: muted })
    p.text(value, x, 70, 11, { color: night })
  })

  // Tear line and ticket code
  p.line(278, 30, 278, 290, '#c9c3ba', 0.75)
  for (let y = 34; y < 286; y += 14) p.rect(275, y, 6, 6, paper)
  p.text('AD26 - 0918 - A07', 316, 36, 8, { color: muted })
  p.text('TINYPDF', 596, 36, 8, { color: violet, align: 'right', width: 70 })
})

await Bun.write(new URL('./event-ticket.pdf', import.meta.url).pathname, doc.build())
console.log('Created examples/event-ticket.pdf')
