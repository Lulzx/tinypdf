import { pdf } from '../src/index'

const doc = pdf()
const W = 612, H = 792

doc.page(W, H, p => {
  const ink = '#172033', muted = '#657087', blue = '#3563e9'
  const mint = '#56d6b2', pale = '#f3f6fb', line = '#dce3ee'

  // Editorial masthead
  p.rect(0, 0, W, H, '#ffffff')
  p.rect(0, 740, W, 52, ink)
  p.rect(40, 758, 24, 4, mint)
  p.text('NORTHSTAR', 74, 750, 11, { color: '#ffffff' })
  p.text('QUARTERLY BRIEF / Q3 2026', 350, 750, 9, { color: '#aeb8ca', align: 'right', width: 222 })

  p.text('Momentum,', 40, 678, 34, { color: ink })
  p.text('made measurable.', 40, 638, 34, { color: blue })
  p.text('A concise view of growth, retention, and the signals shaping next quarter.', 40, 605, 11, { color: muted })

  // KPI cards
  const cards = [
    { x: 40, label: 'REVENUE', value: '$4.82M', delta: '+18.4% YoY', color: blue },
    { x: 218, label: 'ACTIVE TEAMS', value: '12,840', delta: '+1,920 this quarter', color: mint },
    { x: 396, label: 'NET RETENTION', value: '118%', delta: '+6 pts YoY', color: '#f4a261' },
  ]
  for (const card of cards) {
    p.rect(card.x, 480, 162, 96, pale)
    p.rect(card.x, 480, 4, 96, card.color)
    p.text(card.label, card.x + 18, 548, 8, { color: muted })
    p.text(card.value, card.x + 18, 515, 23, { color: ink })
    p.text(card.delta, card.x + 18, 493, 9, { color: card.color })
  }

  // Bar chart
  p.text('REVENUE TRAJECTORY', 40, 438, 9, { color: muted })
  p.text('Consistent expansion across the last six quarters', 40, 415, 16, { color: ink })
  const values = [52, 61, 66, 78, 88, 104]
  const labels = ['Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26']
  p.line(40, 258, 390, 258, line, 0.75)
  values.forEach((value, i) => {
    const x = 48 + i * 57
    p.rect(x, 258, 28, value, i === values.length - 1 ? blue : '#bdcae8')
    p.text(labels[i], x - 8, 240, 8, { color: muted, align: 'center', width: 44 })
  })

  // Narrative panel
  p.rect(414, 220, 158, 218, ink)
  p.text('SIGNAL', 432, 412, 8, { color: mint })
  p.text('Expansion is', 432, 382, 17, { color: '#ffffff' })
  p.text('outpacing new', 432, 360, 17, { color: '#ffffff' })
  p.text('logo growth.', 432, 338, 17, { color: '#ffffff' })
  p.line(432, 314, 554, 314, '#44506a', 0.75)
  p.text('Existing customers now', 432, 291, 9, { color: '#c2cad8' })
  p.text('drive 41% of net-new ARR.', 432, 275, 9, { color: '#c2cad8' })
  p.text('Prioritize adoption in', 432, 251, 9, { color: '#c2cad8' })
  p.text('teams with 20+ seats.', 432, 235, 9, { color: '#c2cad8' })

  // Footer takeaways
  p.line(40, 198, 572, 198, line, 0.75)
  p.text('THREE MOVES FOR Q4', 40, 170, 9, { color: muted })
  const moves = [
    ['01', 'Deepen adoption', 'Launch role-based onboarding for larger teams.'],
    ['02', 'Protect velocity', 'Keep sales cycles below the 31-day threshold.'],
    ['03', 'Scale proof', 'Turn expansion wins into vertical case studies.'],
  ]
  moves.forEach(([num, title, body], i) => {
    const x = 40 + i * 178
    p.text(num, x, 132, 9, { color: blue })
    p.text(title, x + 26, 132, 11, { color: ink })
    p.text(body, x + 26, 111, 8, { color: muted })
  })

  p.text('NORTHSTAR / INTERNAL', 40, 34, 8, { color: '#9aa4b5' })
  p.text('01', 532, 34, 8, { color: '#9aa4b5', align: 'right', width: 40 })
})

await Bun.write(new URL('./executive-report.pdf', import.meta.url).pathname, doc.build())
console.log('Created examples/executive-report.pdf')
