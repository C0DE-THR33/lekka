// Stand-in for Supabase when .env.local is missing. Mirrors supabase/seed.sql:
// 7 days of Rows Kitchen entries ending today, kept in this browser and
// regenerated each new IST day.
import type { DayClose, Txn } from './db'
import { IST_OFFSET_MS, istDayStart } from './summary'

const KEY = 'mock-txns'
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const PAYEES = ['Vegetable vendor', 'Wrap bread supplier', 'Dairy supplier', 'Gas cylinder']

const between = (min: number, max: number, step: number) => min + Math.floor((Math.random() * (max - min)) / step) * step

function row(fields: Pick<Txn, 'direction' | 'mode' | 'amount_paise' | 'source' | 'occurred_at'> & Partial<Txn>): Txn {
  // Not crypto.randomUUID(): it's missing on plain-http pages (a phone opening the laptop's IP).
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
  return { id, category: null, payee: null, upi_ref: null, voided_at: null, void_reason: null, ...fields }
}

function generate(now: Date): Txn[] {
  const today = istDayStart(now).getTime()
  const txns: Txn[] = []
  for (let d = 0; d < 7; d++) {
    const start = today - d * DAY_MS
    const weekend = [0, 6].includes(new Date(start + IST_OFFSET_MS).getUTCDay())
    // Past days: open 3:00–10:30 PM. Today: a third of the volume, in the last 3 hours
    // (or since midnight, if that's sooner) so the demo looks like a shift in progress.
    const at = () => new Date(d === 0
      ? now.getTime() - Math.random() * Math.min(now.getTime() - start, 3 * HOUR_MS)
      : start + 15 * HOUR_MS + Math.random() * 7.5 * HOUR_MS).toISOString()
    const count = (n: number) => (d === 0 ? Math.max(1, Math.floor(n / 3)) : n)

    for (let i = 0; i < count(weekend ? 25 : 20); i++) {
      txns.push(row({ direction: 'in', mode: 'upi', amount_paise: between(300, 500, 10) * 100, source: 'simulated',
        upi_ref: fakeUpiRef(), occurred_at: at() }))
    }
    for (let i = 0; i < count(weekend ? 10 : 5); i++) {
      txns.push(row({ direction: 'in', mode: 'cash', amount_paise: between(300, 500, 10) * 100, source: 'counter', occurred_at: at() }))
    }
    for (let i = 0; i < count(3); i++) {
      txns.push(row({ direction: 'out', mode: Math.random() < 0.5 ? 'cash' : 'upi', amount_paise: between(300, 2000, 50) * 100,
        category: 'Supplies', payee: PAYEES[Math.floor(Math.random() * PAYEES.length)], source: 'owner', occurred_at: at() }))
    }
  }
  return txns
}

let store: { day: string; txns: Txn[] } | null = null

function load(): Txn[] {
  const now = new Date()
  const day = istDayStart(now).toISOString()
  if (!store) {
    try {
      store = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      store = null
    }
  }
  // Also regenerates data saved by the older multi-shop version (it had shop_id).
  if (store?.day !== day || store.txns.some(t => 'shop_id' in t)) {
    store = { day, txns: generate(now) }
    save()
  }
  return store.txns
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Storage blocked: mock data lives in memory until reload.
  }
}

export const fakeUpiRef = () => 'DEMO' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')

export function mockTxnsSince(since: Date): Txn[] {
  return load()
    .filter(t => new Date(t.occurred_at) >= since)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
}

const listeners = new Set<() => void>()

export function mockInsert(fields: Pick<Txn, 'direction' | 'mode' | 'amount_paise' | 'source'> & Partial<Txn>) {
  load().push(row({ ...fields, occurred_at: new Date().toISOString() }))
  save()
  listeners.forEach(f => f())
}

export function mockVoid(id: string, reason: string) {
  const t = load().find(x => x.id === id && !x.voided_at)
  if (!t) throw new Error('Already voided')
  t.voided_at = new Date().toISOString()
  t.void_reason = reason
  save()
  listeners.forEach(f => f())
}

const CLOSES_KEY = 'mock-closes'

function loadCloses(): Record<string, DayClose> {
  try {
    return JSON.parse(localStorage.getItem(CLOSES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const mockGetDayClose = (day: string): DayClose | null => loadCloses()[day] ?? null

export function mockSaveDayClose(close: DayClose) {
  try {
    localStorage.setItem(CLOSES_KEY, JSON.stringify({ ...loadCloses(), [close.day]: close }))
  } catch {
    throw new Error("This browser won't store data")
  }
}

/** Fires for changes in this tab and, through the storage event, in other tabs. */
export function mockSubscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    store = null // another tab wrote; re-read on next load()
    onChange()
  }
  addEventListener('storage', onStorage)
  listeners.add(onChange)
  return () => {
    removeEventListener('storage', onStorage)
    listeners.delete(onChange)
  }
}
