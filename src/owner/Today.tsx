import { useEffect, useState } from 'react'
import { getDayClose, simulateUpi, type DayClose, type Txn } from '../lib/db'
import { useLang, useT, type Key } from '../lib/i18n'
import { formatRupees, formatTime } from '../lib/money'
import { dailySummary, expensesByCategory, istDate, reconcile, splitAtClose } from '../lib/summary'
import { useTodayTxns } from '../lib/useTodayTxns'
import { gapText } from './CloseDay'
import { describe } from './Transactions'

const RECENT = 5

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export function Today({ onOpen }: { onOpen: (view: 'entries' | 'close') => void }) {
  const t = useT()
  const lang = useLang()
  const { txns, error } = useTodayTxns()
  const [close, setClose] = useState<DayClose | null | undefined>(undefined) // undefined = loading or failed
  const [updatedAt, setUpdatedAt] = useState('')

  useEffect(() => {
    getDayClose(istDate(new Date())).then(setClose, () => {}) // the Close day tab shows the error
  }, [])

  useEffect(() => {
    if (txns) setUpdatedAt(new Date().toISOString())
  }, [txns])

  if (error) return <p className="error">{t('loadTodayError', { error })}</p>
  if (!txns) return <p>{t('loading')}</p>

  const s = dailySummary(txns)
  const date = new Date().toLocaleDateString(lang === 'kn' ? 'kn-IN' : 'en-IN',
    { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })

  return (
    <div className="overview">
      <section className="card span" aria-labelledby="today-h">
        <div className="card-head">
          <h2 id="today-h">{t('today')} <span className="muted">· {date}</span></h2>
          {updatedAt && <span className="live">{t('liveUpdated', { time: formatTime(updatedAt) })}</span>}
        </div>
        <p className="label">{t('sales')}</p>
        <p className="hero">{formatRupees(s.sales)}</p>
        <div className="split" aria-hidden="true">
          <span className="seg-upi" style={{ width: `${pct(s.upi, s.sales)}%` }} />
          <span className="seg-cash" style={{ width: `${pct(s.cash, s.sales)}%` }} />
        </div>
        <dl className="legend">
          <div><dt><i className="seg-upi" />{t('upi')}</dt><dd>{formatRupees(s.upi)} <span className="muted">{pct(s.upi, s.sales)}%</span></dd></div>
          <div><dt><i className="seg-cash" />{t('cash')}</dt><dd>{formatRupees(s.cash)} <span className="muted">{pct(s.cash, s.sales)}%</span></dd></div>
        </dl>
        <dl className="stats">
          <div><dt className="label">{t('expenses')}</dt><dd>{formatRupees(s.expenses)}</dd></div>
          <div>
            <dt className="label">{t('estProfit')}</dt>
            <dd className={s.profit < 0 ? 'error' : undefined}>{formatRupees(s.profit)}</dd>
          </div>
        </dl>
      </section>

      <DayStatus close={close} txns={txns} summary={s} onOpen={() => onOpen('close')} />
      <Recent txns={txns} onOpen={() => onOpen('entries')} />
      <Expenses txns={txns} total={s.expenses} />
      <Simulate />
    </div>
  )
}

function DayStatus({ close, txns, summary, onOpen }: {
  close: DayClose | null | undefined; txns: Txn[]; summary: ReturnType<typeof dailySummary>; onOpen: () => void
}) {
  const t = useT()
  const expectedNow = reconcile(summary, 0, 0).expectedCash
  // The counted cash and bank UPI were read at close time, so check them only against entries made by then.
  const { before, after } = close ? splitAtClose(txns, close.closed_at) : { before: txns, after: 0 }
  const r = reconcile(dailySummary(before), close?.counted_cash_paise ?? 0, close?.bank_upi_paise ?? 0)
  const line = (gap: number, keys: [Key, Key, Key]) => (
    <li className={gap === 0 ? 'ok' : 'error'}>{gapText(t, gap, ...keys)}</li>
  )
  return (
    <section className="card" aria-labelledby="status-h">
      <h2 id="status-h">{t('dayStatus')}</h2>
      <p className="label">{t('drawerExpected')}</p>
      <p className="figure">{formatRupees(expectedNow)}</p>
      <p className="muted">{t('drawerHint')}</p>
      {close ? (
        <>
          <p className="muted">{t('dayClosedAt', { time: formatTime(close.closed_at) })}</p>
          <ul className="gaps">
            {line(r.cashGap, ['cashMatches', 'cashShort', 'cashOver'])}
            {line(r.upiGap, ['upiMatches', 'upiShort', 'upiOver'])}
          </ul>
          {after > 0 && <p className="pending">{t('entriesAfterClose', { n: after })}</p>}
        </>
      ) : close === null && <p className="pending">{t('dayOpen')}</p>}
      <button className={close ? 'big' : 'big primary'} onClick={onOpen}>
        {close ? t('reviewClose') : t('closeTheDay')}
      </button>
    </section>
  )
}

function Expenses({ txns, total }: { txns: Txn[]; total: number }) {
  const t = useT()
  const rows = expensesByCategory(txns)
  return (
    <section className="card" aria-labelledby="exp-h">
      <h2 id="exp-h">{t('whereMoneyWent')}</h2>
      {rows.length ? (
        <ul className="bars">
          {rows.map(([c, paise]) => (
            <li key={c}>
              <span>{t(`cat.${c}` as Key)}</span>
              <span className="num">{formatRupees(paise)}</span>
              <span className="bar" aria-hidden="true"><span style={{ width: `${pct(paise, total)}%` }} /></span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">{t('noExpenses')}</p>}
    </section>
  )
}

function Recent({ txns, onOpen }: { txns: Txn[]; onOpen: () => void }) {
  const t = useT()
  return (
    <section className="card tall" aria-labelledby="recent-h">
      <h2 id="recent-h">{t('latestEntries')}</h2>
      {txns.length ? (
        <ul className="feed mini">
          {txns.slice(0, RECENT).map(x => (
            <li key={x.id} className={x.voided_at ? 'voided' : undefined}>
              <span className={x.direction === 'out' ? 'amount-out' : undefined}>
                {x.direction === 'out' ? '−' : ''}{formatRupees(x.amount_paise)}
              </span>
              <span className="muted">{formatTime(x.occurred_at)}</span>
              <span className="muted detail">{describe(x, t)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">{t('noEntries')}</p>}
      {txns.length > 0 && (
        <button className="link" onClick={onOpen}>{t('seeAllEntries', { n: txns.length })}</button>
      )}
    </section>
  )
}

export function Simulate() {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [simError, setSimError] = useState('')

  const onSimulate = async () => {
    setBusy(true)
    setSimError('')
    try {
      await simulateUpi()
    } catch (e) {
      setSimError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="demo span">
      <p className="label">{t('demo')}</p>
      <button className="big" onClick={onSimulate} disabled={busy}>
        {busy ? t('sending') : t('simulateUpi')}
      </button>
      <p className="muted">{t('simulateHint')}</p>
      {simError && <p className="error">{t('simulateError', { error: simError })}</p>}
    </section>
  )
}
