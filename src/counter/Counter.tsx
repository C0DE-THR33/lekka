import { useEffect, useRef, useState } from 'react'
import type { Txn } from '../lib/db'
import { formatRupees, formatTime } from '../lib/money'
import { useT } from '../lib/i18n'
import { useTodayTxns } from '../lib/useTodayTxns'
import { CashEntry } from './CashEntry'
import { ExpenseEntry, ExpenseList } from './Expenses'

const isUpiIn = (t: Txn) => t.direction === 'in' && t.mode === 'upi' && !t.voided_at
// The worker's own view of sales: UPI arriving plus cash they rang up, voided ones included.
const isFeedSale = (t: Txn) => t.direction === 'in' && (t.mode === 'upi' || t.source === 'counter')
const refTail = (ref: string | null) => ref?.slice(-4)

/** Two short rising tones, made with Web Audio so no sound file is needed. */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime
  ;[880, 1320].forEach((freq, i) => {
    const start = now + i * 0.15
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.45)
  })
}

export function Counter() {
  const t = useT()
  const { txns, error } = useTodayTxns()
  const audio = useRef<AudioContext | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const [started, setStarted] = useState(false)
  const [tab, setTab] = useState<'payments' | 'expenses'>('payments')

  // Chime for UPI payments that weren't there on the previous load.
  useEffect(() => {
    if (!txns) return
    const upi = txns.filter(isUpiIn)
    if (!seen.current) {
      seen.current = new Set(upi.map(x => x.id))
      return
    }
    const added = upi.filter(x => !seen.current!.has(x.id))
    added.forEach(x => seen.current!.add(x.id))
    if (added.length && audio.current) playChime(audio.current)
  }, [txns])

  const startShift = () => {
    // Browsers only allow sound after a tap, so the audio is created here.
    audio.current = new AudioContext()
    playChime(audio.current)
    setStarted(true)
  }

  if (!started) {
    return (
      <>
        <button className="big primary" onClick={startShift}>{t('startShift')}</button>
        <p className="muted">{t('startShiftHint')}</p>
      </>
    )
  }

  if (error) return <p className="error">{t('loadPaymentsError', { error })}</p>
  if (!txns) return <p>{t('loading')}</p>

  const [newest] = txns.filter(isUpiIn)
  // Counts, never rupee totals: the counter doesn't show sales.
  const counts = {
    upi: txns.filter(isUpiIn).length,
    cash: txns.filter(x => x.direction === 'in' && x.mode === 'cash' && x.source === 'counter' && !x.voided_at).length,
  }
  const feed = txns.filter(x => isFeedSale(x) && x.id !== newest?.id).slice(0, 10)

  // Two columns on a laptop: entry on the left, the day's list on the right. One column on a phone.
  return (
    <div className="counter-cols">
      <div>
        <p className="strip"><span className="live">{t('liveNow')}</span><span>{t('todayCounts', counts)}</span></p>
        {newest ? (
          <section key={newest.id} className="banner" aria-live="polite">
            <p className="tick" aria-hidden="true">✓</p>
            <p className="hero">{formatRupees(newest.amount_paise)}</p>
            <p>{t('receivedUpi', { time: formatTime(newest.occurred_at) })}</p>
            {newest.upi_ref && <p className="ref">{t('upiRef', { ref: refTail(newest.upi_ref)! })}</p>}
          </section>
        ) : (
          <p className="muted">{t('waitingUpi')}</p>
        )}

        <nav className="tabs counter-tabs">
          {(['payments', 'expenses'] as const).map(v => (
            <button key={v} aria-pressed={tab === v} onClick={() => setTab(v)}>{t(`tab.${v}`)}</button>
          ))}
        </nav>

        {tab === 'expenses' ? <ExpenseEntry /> : <CashEntry />}
      </div>

      <section>
        {tab === 'expenses' ? <ExpenseList txns={txns} /> : (
          <>
            <h2 className="label">{t('earlierToday')}</h2>
            {feed.length ? (
              <ul className="feed sales">
                {feed.map(x => (
                  <li key={x.id} className={x.voided_at ? 'voided' : undefined}>
                    <i className={x.mode === 'upi' ? 'seg-upi' : 'seg-cash'} aria-hidden="true" />
                    <span className="amt">{formatRupees(x.amount_paise)}</span>
                    <span className="muted">
                      {x.mode === 'upi'
                        ? [t('upiAt', { time: formatTime(x.occurred_at) }), x.upi_ref && t('upiRef', { ref: refTail(x.upi_ref)! })]
                          .filter(Boolean).join(' · ')
                        : t('cashSaleAt', { time: formatTime(x.occurred_at) })}
                    </span>
                    {x.voided_at && <span className="detail error">{t('voidedByOwner', { reason: x.void_reason ?? '' })}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">{t('noEntries')}</p>}
          </>
        )}
      </section>
    </div>
  )
}
