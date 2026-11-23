// Pure money logic: integer paise, no I/O.

export type SummaryTxn = {
  direction: 'in' | 'out'
  mode: 'upi' | 'cash' | 'card'
  amount_paise: number
  source: 'counter' | 'owner' | 'simulated'
  voided_at: string | null
}

const DAY_MS = 86_400_000
export const IST_OFFSET_MS = 330 * 60_000 // UTC+5:30, no daylight saving

/** Midnight in India for the day containing `now`. */
export function istDayStart(now: Date): Date {
  return new Date(Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS)
}

/** India calendar date, "2026-11-02". */
export function istDate(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function dailySummary(txns: SummaryTxn[]) {
  const live = txns.filter(t => !t.voided_at)
  const sum = (f: (t: SummaryTxn) => boolean) =>
    live.filter(f).reduce((s, t) => s + t.amount_paise, 0)
  const sales = sum(t => t.direction === 'in')
  const expenses = sum(t => t.direction === 'out')
  return {
    sales,
    upi: sum(t => t.direction === 'in' && t.mode === 'upi'),
    cash: sum(t => t.direction === 'in' && t.mode === 'cash'),
    // Cash taken out of the counter drawer. Owners pay cash from money they withdraw themselves.
    drawerOut: sum(t => t.direction === 'out' && t.mode === 'cash' && t.source === 'counter'),
    expenses,
    profit: sales - expenses,
  }
}

/**
 * Close-the-day check. Gaps are actual − expected: negative = short, positive = over.
 * Expected cash in the drawer = cash sales − cash expenses paid at the counter (no opening float).
 */
export function reconcile(s: ReturnType<typeof dailySummary>, countedCash: number, bankUpi: number) {
  const expectedCash = s.cash - s.drawerOut
  return { expectedCash, cashGap: countedCash - expectedCash, upiGap: bankUpi - s.upi }
}

/** Live expenses totalled per category, largest first. No category counts as 'Other'. */
export function expensesByCategory(txns: (SummaryTxn & { category: string | null })[]): [string, number][] {
  const totals = new Map<string, number>()
  for (const t of txns) {
    if (t.direction !== 'out' || t.voided_at) continue
    const c = t.category ?? 'Other'
    totals.set(c, (totals.get(c) ?? 0) + t.amount_paise)
  }
  return [...totals].sort((a, b) => b[1] - a[1])
}

type DatedTxn = SummaryTxn & { occurred_at: string }

/** Live sales and expenses per India day, for the `days` days ending on `now`'s day, oldest first. */
export function dailyTotals(txns: DatedTxn[], now: Date, days = 7) {
  const out = Array.from({ length: days }, (_, i) =>
    ({ day: istDate(new Date(now.getTime() - (days - 1 - i) * DAY_MS)), sales: 0, expenses: 0 }))
  const index = new Map(out.map((d, i) => [d.day, i]))
  for (const t of txns) {
    const i = index.get(istDate(new Date(t.occurred_at)))
    if (i === undefined || t.voided_at) continue
    out[i][t.direction === 'in' ? 'sales' : 'expenses'] += t.amount_paise
  }
  return out
}

/** Live sales per India hour of day: index 19 is 7–8 PM. */
export function salesByHour(txns: DatedTxn[]): number[] {
  const hours = Array<number>(24).fill(0)
  for (const t of txns) {
    if (t.direction !== 'in' || t.voided_at) continue
    hours[new Date(new Date(t.occurred_at).getTime() + IST_OFFSET_MS).getUTCHours()] += t.amount_paise
  }
  return hours
}

/**
 * Entries made by the time of a day close, and how many came after it. Compares as dates,
 * not strings: the database writes "+00:00" where the browser writes "Z".
 */
// ponytail: closed_at is the owner's phone clock, occurred_at is the server's; a phone far off
// the right time misplaces entries near the close. Stamp closed_at on the server if that bites.
export function splitAtClose<T extends { occurred_at: string }>(txns: T[], closedAt: string) {
  const cut = new Date(closedAt).getTime()
  const before = txns.filter(t => new Date(t.occurred_at).getTime() <= cut)
  return { before, after: txns.length - before.length }
}
