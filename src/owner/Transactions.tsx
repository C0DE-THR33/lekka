import { useState, type FormEvent } from 'react'
import { voidTxn, type Txn } from '../lib/db'
import { useT, type Key, type T } from '../lib/i18n'
import { formatRupees, formatTime } from '../lib/money'
import { useTodayTxns } from '../lib/useTodayTxns'

export function describe(x: Txn, t: T) {
  const what = x.direction === 'in'
    ? t('sale')
    : [x.category && t(`cat.${x.category}` as Key), x.payee && t('toPayee', { payee: x.payee })].filter(Boolean).join(' ')
  return [t(x.mode as Key), what, t(`source.${x.source}`)].join(' · ')
}

export function Transactions() {
  const t = useT()
  const { txns, error } = useTodayTxns()
  const [openId, setOpenId] = useState<string | null>(null)

  if (error) return <p className="error">{t('loadTodayError', { error })}</p>
  if (!txns) return <p>{t('loading')}</p>
  if (!txns.length) return <p className="muted">{t('noEntries')}</p>

  return (
    <ul className="feed entries">
      {txns.map(x => (
        <li key={x.id} className={x.voided_at ? 'voided' : undefined}>
          <button
            className="entry-row"
            disabled={!!x.voided_at}
            aria-expanded={openId === x.id}
            onClick={() => setOpenId(openId === x.id ? null : x.id)}
          >
            <span className={x.direction === 'out' ? 'amount-out' : undefined}>
              {x.direction === 'out' ? '−' : ''}{formatRupees(x.amount_paise)}
            </span>
            <span className="muted">{formatTime(x.occurred_at)}</span>
            <span className="muted detail">{describe(x, t)}</span>
            {x.voided_at && <span className="muted detail">{t('voidedReason', { reason: x.void_reason ?? '' })}</span>}
          </button>
          {openId === x.id && <VoidForm id={x.id} onDone={() => setOpenId(null)} />}
        </li>
      ))}
    </ul>
  )
}

export function VoidForm({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useT()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await voidTxn(id, reason.trim())
      onDone()
    } catch (err) {
      setError(t('notVoided', { error: (err as Error).message }))
      setBusy(false)
    }
  }

  return (
    <form className="void-form" onSubmit={submit}>
      <label className="label" htmlFor={`void-${id}`}>{t('whyVoid')}</label>
      <input
        id={`void-${id}`}
        className="text"
        maxLength={100}
        autoFocus
        placeholder={t('whyVoidPlaceholder')}
        value={reason}
        onChange={e => setReason(e.target.value)}
      />
      <div className="pair">
        <button type="submit" className="big danger" disabled={!reason.trim() || busy}>{t('voidEntry')}</button>
        <button type="button" className="big" onClick={onDone}>{t('cancel')}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
