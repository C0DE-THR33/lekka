import { createClient } from '@supabase/supabase-js'
import {
  fakeUpiRef, mockGetDayClose, mockInsert, mockSaveDayClose, mockSubscribe, mockTxnsSince, mockVoid,
} from './mockDb'
import type { SummaryTxn } from './summary'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Without .env.local, or with ?mock in the address, the app runs on mock data kept in this browser only.
export const usingMock = !(url && key) || new URLSearchParams(location.search).has('mock')
const db = usingMock ? null : createClient(url, key)

export type Txn = SummaryTxn & {
  id: string
  category: string | null
  payee: string | null
  upi_ref: string | null
  occurred_at: string
  void_reason: string | null
}

/** Newest first. */
export async function listTxnsSince(since: Date): Promise<Txn[]> {
  if (!db) return mockTxnsSince(since)
  const { data, error } = await db
    .from('transactions')
    .select('*')
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return data
}

/** The 5 most recently used payees, for suggestions. */
export async function listRecentPayees(): Promise<string[]> {
  let rows: { payee: string | null }[]
  if (!db) {
    rows = mockTxnsSince(new Date(0))
  } else {
    const { data, error } = await db
      .from('transactions')
      .select('payee')
      .not('payee', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(50)
    if (error) throw error
    rows = data
  }
  return [...new Set(rows.flatMap(r => (r.payee ? [r.payee] : [])))].slice(0, 5)
}

export type NewTxn = Pick<Txn, 'direction' | 'mode' | 'amount_paise' | 'source'> &
  Partial<Pick<Txn, 'category' | 'payee' | 'upi_ref'>>

export async function insertTxn(fields: NewTxn): Promise<void> {
  if (!db) return mockInsert(fields)
  const { error } = await db.from('transactions').insert(fields)
  if (error) throw error
}

/** Marks a transaction void (it stays listed, out of totals). Fails if it's already void. */
export async function voidTxn(id: string, reason: string): Promise<void> {
  if (!db) return mockVoid(id, reason)
  const { data, error } = await db
    .from('transactions')
    .update({ voided_at: new Date().toISOString(), void_reason: reason })
    .eq('id', id)
    .is('voided_at', null)
    .select('id')
  if (error) throw error
  if (!data.length) throw new Error('Already voided')
}

export type DayClose = {
  day: string // India date, "2026-11-02"
  counted_cash_paise: number
  bank_upi_paise: number
  closed_at: string
}

export async function getDayClose(day: string): Promise<DayClose | null> {
  if (!db) return mockGetDayClose(day)
  const { data, error } = await db.from('day_closes').select('*').eq('day', day).maybeSingle()
  if (error) throw error
  return data
}

/** Saves the day's close; closing the same day again replaces it. */
export async function saveDayClose(close: DayClose): Promise<void> {
  if (!db) return mockSaveDayClose(close)
  const { error } = await db.from('day_closes').upsert(close, { onConflict: 'day' })
  if (error) throw error
}

/** Demo stand-in for a customer paying by UPI: ₹150–₹500. */
export function simulateUpi(): Promise<void> {
  const rupees = 150 + Math.floor(Math.random() * 36) * 10
  return insertTxn({ direction: 'in', mode: 'upi', amount_paise: rupees * 100, source: 'simulated', upi_ref: fakeUpiRef() })
}

/** Calls onChange whenever any transaction is added or changed. Returns an unsubscribe function. */
export function subscribe(onChange: () => void): () => void {
  if (!db) return mockSubscribe(onChange)
  const channel = db
    // Not crypto.randomUUID(): it's missing on plain-http pages (a phone opening the laptop's IP).
    .channel('transactions-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, onChange)
    // Reload on (re)connect so anything missed while offline shows up.
    .subscribe(status => { if (status === 'SUBSCRIBED') onChange() })
  return () => { db.removeChannel(channel) }
}
