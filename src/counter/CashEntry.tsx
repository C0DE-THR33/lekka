import { useState } from 'react'
import { insertTxn } from '../lib/db'
import { useT } from '../lib/i18n'
import { formatRupees } from '../lib/money'

const MAX_RUPEES = 100_000 // catches typos like an extra zero; counter cash is small

export function CashEntry() {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  const rupees = Number(amount)
  const valid = amount !== '' && rupees > 0 && rupees <= MAX_RUPEES

  const save = async () => {
    if (!valid) return
    setBusy(true)
    setMessage(null)
    try {
      await insertTxn({ direction: 'in', mode: 'cash', amount_paise: rupees * 100, source: 'counter' })
      setMessage({ text: t('cashSaleSaved', { amount: formatRupees(rupees * 100) }) })
      setAmount('')
    } catch (e) {
      setMessage({ text: t('notSaved', { error: (e as Error).message }), error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card entry">
      <label className="label" htmlFor="cash-amount">{t('cashAmount')}</label>
      <input
        id="cash-amount"
        className="amount"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={amount}
        onChange={e => {
          setAmount(e.target.value.replace(/\D/g, ''))
          setMessage(null)
        }}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
      />
      {amount !== '' && !valid && <p className="error">{t('amountRangeCounter')}</p>}
      <button className="big primary" disabled={!valid || busy} onClick={save}>{t('cashSale')}</button>
      {message && <p className={message.error ? 'error' : 'ok'} role="status">{message.text}</p>}
    </section>
  )
}
