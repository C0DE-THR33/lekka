import { useEffect, useState, type FormEvent } from 'react'
import { getDayClose, saveDayClose, type DayClose } from '../lib/db'
import { useT, type Key, type T } from '../lib/i18n'
import { formatRupees, formatTime } from '../lib/money'
import { dailySummary, istDate, reconcile, splitAtClose } from '../lib/summary'
import { useTodayTxns } from '../lib/useTodayTxns'

const MAX_RUPEES = 1_000_000

const toRupeesText = (paise: number) => String(paise / 100)

/** "✓ Matches", "Cash short ₹150", … for a gap of actual − expected. */
export const gapText = (t: T, gap: number, matchKey: Key, shortKey: Key, overKey: Key) =>
  gap === 0 ? t(matchKey) : t(gap < 0 ? shortKey : overKey, { amount: formatRupees(Math.abs(gap)) })

function Check({ label, expected, actual, gap, shortKey, overKey }: {
  label: string; expected: number; actual: number; gap: number; shortKey: Key; overKey: Key
}) {
  const t = useT()
  return (
    <div className="check">
      <dt>{label}</dt>
      <dd>{t('expectedActual', { expected: formatRupees(expected), actual: formatRupees(actual) })}</dd>
      <dd className={gap === 0 ? 'ok' : 'error'}>{gapText(t, gap, 'matches', shortKey, overKey)}</dd>
    </div>
  )
}

export function CloseDay() {
  const t = useT()
  const { txns, error } = useTodayTxns()
  const [day] = useState(() => istDate(new Date()))
  const [saved, setSaved] = useState<DayClose | null | undefined>(undefined) // undefined = loading
  const [cash, setCash] = useState('')
  const [upi, setUpi] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    getDayClose(day).then(
      c => {
        setSaved(c)
        if (c) {
          setCash(toRupeesText(c.counted_cash_paise))
          setUpi(toRupeesText(c.bank_upi_paise))
        }
      },
      (e: Error) => { setSaved(null); setLoadError(e.message) },
    )
  }, [day])

  if (error) return <p className="error">{t('loadTodayError', { error })}</p>
  if (!txns || saved === undefined) return <p>{t('loading')}</p>

  // '' is "not entered"; 0 is a real answer (an empty drawer).
  const parse = (s: string) => (s === '' || Number(s) > MAX_RUPEES ? null : Number(s) * 100)
  const countedCash = parse(cash)
  const bankUpi = parse(upi)
  const summary = dailySummary(txns)
  // Saving stamps a new close time, so the checks below use every entry; this flags ones the saved close missed.
  const lateEntries = saved ? splitAtClose(txns, saved.closed_at).after : 0
  const result = countedCash !== null && bankUpi !== null ? reconcile(summary, countedCash, bankUpi) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (countedCash === null || bankUpi === null) return
    setBusy(true)
    setSaveError('')
    const close = { day, counted_cash_paise: countedCash, bank_upi_paise: bankUpi, closed_at: new Date().toISOString() }
    try {
      await saveDayClose(close)
      setSaved(close)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const amountInput = (id: string, value: string, set: (s: string) => void) => (
    <input
      id={id}
      className="amount"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={value}
      onChange={e => set(e.target.value.replace(/\D/g, ''))}
    />
  )

  return (
    <form className="card entry" onSubmit={submit}>
      <h2>{t('closeTheDay')}</h2>
      {saved && <p className="muted">{t('closedAt', { time: formatTime(saved.closed_at) })}</p>}
      {lateEntries > 0 && <p className="pending">{t('closeStale', { n: lateEntries })}</p>}
      {loadError && <p className="error">{t('loadCloseError', { error: loadError })}</p>}

      <label className="label" htmlFor="close-cash">{t('countedCash')}</label>
      {amountInput('close-cash', cash, setCash)}

      <label className="label" htmlFor="close-upi">{t('bankUpi')}</label>
      {amountInput('close-upi', upi, setUpi)}

      {(cash !== '' && countedCash === null) || (upi !== '' && bankUpi === null)
        ? <p className="error">{t('amountMax')}</p>
        : null}

      {result && (
        <dl className="checks">
          <Check label={t('cash')} expected={result.expectedCash} actual={countedCash!} gap={result.cashGap}
            shortKey="cashShort" overKey="cashOver" />
          <Check label={t('upi')} expected={summary.upi} actual={bankUpi!} gap={result.upiGap}
            shortKey="upiShort" overKey="upiOver" />
        </dl>
      )}

      <button type="submit" className="big primary" disabled={!result || busy}>
        {busy ? t('saving') : saved ? t('updateClose') : t('closeTheDay')}
      </button>
      {saveError && <p className="error">{t('notSaved', { error: saveError })}</p>}
    </form>
  )
}
