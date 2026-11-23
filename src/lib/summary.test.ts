import { expect, test } from 'vitest'
import { dailySummary, dailyTotals, expensesByCategory, istDate, istDayStart, reconcile, salesByHour, splitAtClose, type SummaryTxn } from './summary'

const t = (direction: 'in' | 'out', mode: 'upi' | 'cash' | 'card', rupees: number, voided = false,
  source: SummaryTxn['source'] = 'owner'): SummaryTxn =>
  ({ direction, mode, amount_paise: rupees * 100, source, voided_at: voided ? '2026-11-02T10:00:00Z' : null })

test('dailySummary splits modes, counts card in sales, skips voided rows', () => {
  const s = dailySummary([
    t('in', 'upi', 350),
    t('in', 'upi', 400),
    t('in', 'cash', 200),
    t('in', 'card', 500),
    t('in', 'cash', 999, true),
    t('out', 'cash', 1200),
    t('out', 'upi', 300, true),
  ])
  expect(s).toEqual({ sales: 145000, upi: 75000, cash: 20000, drawerOut: 0, expenses: 120000, profit: 25000 })
})

test('dailySummary allows a loss and an empty day', () => {
  expect(dailySummary([t('out', 'upi', 1200)]).profit).toBe(-120000)
  expect(dailySummary([])).toEqual({ sales: 0, upi: 0, cash: 0, drawerOut: 0, expenses: 0, profit: 0 })
})

// A day: UPI ₹750 recorded; cash sales ₹1,000; ₹300 cash spent from the drawer at the counter;
// the owner paid ₹1,900 cash from their own pocket (not the drawer) and ₹500 by UPI.
const day = dailySummary([
  t('in', 'upi', 350), t('in', 'upi', 400),
  t('in', 'cash', 600), t('in', 'cash', 400),
  t('out', 'cash', 300, false, 'counter'), t('out', 'cash', 1900), t('out', 'upi', 500),
])

test('only counter cash expenses come out of the drawer', () => {
  expect(day.drawerOut).toBe(30000)
  expect(day.expenses).toBe(270000) // every expense still counts against profit
})

test('reconcile: everything matches', () => {
  expect(reconcile(day, 70000, 75000)).toEqual({ expectedCash: 70000, cashGap: 0, upiGap: 0 })
})

test('reconcile: cash short, UPI in bank but not recorded', () => {
  expect(reconcile(day, 55000, 90000)).toEqual({ expectedCash: 70000, cashGap: -15000, upiGap: 15000 })
})

test('reconcile: cash over, UPI recorded but not in bank', () => {
  expect(reconcile(day, 75000, 70000)).toEqual({ expectedCash: 70000, cashGap: 5000, upiGap: -5000 })
})

test('reconcile: a day with no cash at all', () => {
  const upiOnly = dailySummary([t('in', 'upi', 350)])
  expect(reconcile(upiOnly, 0, 35000)).toEqual({ expectedCash: 0, cashGap: 0, upiGap: 0 })
})

test('expensesByCategory sums live expenses per category, largest first', () => {
  const c = (category: string | null, rupees: number, voided = false) => ({ ...t('out', 'cash', rupees, voided), category })
  expect(expensesByCategory([
    c('Supplies', 300), c('Rent', 5000), c('Supplies', 200), c(null, 50), c('Rent', 900, true),
    { ...t('in', 'upi', 400), category: null },
  ])).toEqual([['Rent', 500000], ['Supplies', 50000], ['Other', 5000]])
})

test('istDate gives the India calendar date', () => {
  expect(istDate(new Date('2026-11-02T18:29:00Z'))).toBe('2026-11-02') // 23:59 IST
  expect(istDate(new Date('2026-11-02T18:31:00Z'))).toBe('2026-11-03') // 00:01 IST next day
})

test('istDayStart uses India midnight, not UTC', () => {
  // 23:59 IST on 2 Nov belongs to 2 Nov; 00:01 IST on 3 Nov starts a new day.
  expect(istDayStart(new Date('2026-11-02T18:29:00Z')).toISOString()).toBe('2026-11-01T18:30:00.000Z')
  expect(istDayStart(new Date('2026-11-02T18:31:00Z')).toISOString()).toBe('2026-11-02T18:30:00.000Z')
  // 03:00 IST is still the same IST day even though UTC is the previous date.
  expect(istDayStart(new Date('2026-11-01T21:30:00Z')).toISOString()).toBe('2026-11-01T18:30:00.000Z')
})

const at = (iso: string, direction: 'in' | 'out', rupees: number, voided = false) =>
  ({ ...t(direction, 'upi', rupees, voided), occurred_at: iso })

test('dailyTotals buckets by India day, oldest first, skipping voided and out-of-range rows', () => {
  const now = new Date('2026-11-03T10:00:00Z') // 3 Nov, 3:30 PM IST
  expect(dailyTotals([
    at('2026-11-02T19:00:00Z', 'in', 400), // 3 Nov 00:30 IST: today, though UTC says 2 Nov
    at('2026-11-02T18:00:00Z', 'in', 300), // 2 Nov 23:30 IST
    at('2026-11-02T12:00:00Z', 'out', 100),
    at('2026-11-02T12:00:00Z', 'in', 999, true),
    at('2026-10-30T12:00:00Z', 'in', 500), // 4 days back: outside a 3-day window
  ], now, 3)).toEqual([
    { day: '2026-11-01', sales: 0, expenses: 0 },
    { day: '2026-11-02', sales: 30000, expenses: 10000 },
    { day: '2026-11-03', sales: 40000, expenses: 0 },
  ])
})

test('salesByHour uses India hours and only live sales', () => {
  const h = salesByHour([
    at('2026-11-02T13:45:00Z', 'in', 350), // 7:15 PM IST
    at('2026-11-02T14:15:00Z', 'in', 150), // 7:45 PM IST
    at('2026-11-02T13:45:00Z', 'out', 900),
    at('2026-11-02T13:45:00Z', 'in', 999, true),
  ])
  expect(h[19]).toBe(50000)
  expect(h.reduce((a, b) => a + b)).toBe(50000)
})

test('splitAtClose keeps entries up to the close, across timestamp formats', () => {
  const { before, after } = splitAtClose([
    { occurred_at: '2026-11-03T14:30:00.000+00:00' }, // 8:00 PM IST, after
    { occurred_at: '2026-11-03T14:25:00+00:00' },     // exactly at the close
    { occurred_at: '2026-11-03T14:00:00Z' },
  ], '2026-11-03T14:25:00.000Z')
  expect(before.map(t => t.occurred_at)).toEqual(['2026-11-03T14:25:00+00:00', '2026-11-03T14:00:00Z'])
  expect(after).toBe(1)
})
