import { useEffect, useState, type FormEvent } from 'react'
import { insertTxn, listRecentPayees, type Txn } from '../lib/db'
import { useT, type Key } from '../lib/i18n'
import { formatRupees, formatTime } from '../lib/money'
import { VoidForm } from '../owner/Transactions'

const MODES = ['cash', 'upi'] as const
// Categories are stored in English and shown translated. Limits catch extra-zero typos.
const SETUP = {
  counter: { categories: ['Supplies', 'Utilities', 'Other'], maxRupees: 100_000, rangeKey: 'amountRangeCounter' },
  // Monthly bills the owner pays from the bank or their own pocket, never from the drawer.
  owner: { categories: ['Rent', 'Salary', 'Utilities', 'Other'], maxRupees: 1_000_000, rangeKey: 'amountRangeOwner' },
} as const

/** Counter Expenses tab, left side: record what the shop paid out. */
export function ExpenseEntry() {
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState('')
  return (
    <>
      <ExpenseForm key={formKey} source="counter" onSaved={m => { setNotice(m); setFormKey(formKey + 1) }} />
      {notice && <p className="ok" role="status">{notice}</p>}
    </>
  )
}

/** Counter Expenses tab, right side: today's counter expenses; tap one to void it. */
export function ExpenseList({ txns }: { txns: Txn[] }) {
  const t = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const mine = txns.filter(x => x.direction === 'out' && x.source === 'counter')

  return (
    <>
      <h2 className="label">{t('counterExpensesToday')}</h2>
      {mine.length ? (
        <ul className="feed entries">
          {mine.map(x => (
            <li key={x.id} className={x.voided_at ? 'voided' : undefined}>
              <button
                className="entry-row"
                disabled={!!x.voided_at}
                aria-expanded={openId === x.id}
                onClick={() => setOpenId(openId === x.id ? null : x.id)}
              >
                <span className="amount-out">−{formatRupees(x.amount_paise)}</span>
                <span className="muted">{formatTime(x.occurred_at)}</span>
                <span className="muted detail">
                  {[t(x.mode as Key), x.category && t(`cat.${x.category}` as Key), x.payee && t('toPayee', { payee: x.payee })]
                    .filter(Boolean).join(' · ')}
                </span>
                {x.voided_at && <span className="muted detail">{t('voidedReason', { reason: x.void_reason ?? '' })}</span>}
              </button>
              {openId === x.id && <VoidForm id={x.id} onDone={() => setOpenId(null)} />}
            </li>
          ))}
        </ul>
      ) : <p className="muted">{t('noExpenses')}</p>}
    </>
  )
}

export function ExpenseForm({ source, onSaved }: { source: 'counter' | 'owner'; onSaved: (message: string) => void }) {
  const t = useT()
  const { categories, maxRupees, rangeKey } = SETUP[source]
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(categories[0])
  const [payee, setPayee] = useState('')
  const [mode, setMode] = useState<'cash' | 'upi'>('cash')
  const [payees, setPayees] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listRecentPayees().then(setPayees, () => {}) // suggestions are optional
  }, [])

  const rupees = Number(amount)
  const valid = amount !== '' && rupees > 0 && rupees <= maxRupees
  const catLabel = (c: string) => t(`cat.${c}` as Key)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError('')
    const name = payee.trim() || null
    try {
      await insertTxn({ direction: 'out', mode, amount_paise: rupees * 100, source, category, payee: name })
      const vars = { amount: formatRupees(rupees * 100), category: catLabel(category), mode: t(mode), payee: name ?? '' }
      onSaved(t(name ? 'expenseSavedTo' : 'expenseSaved', vars))
    } catch (err) {
      setError(t('notSaved', { error: (err as Error).message }))
      setBusy(false)
    }
  }

  return (
    <form className="card entry" onSubmit={submit}>
      <label className="label" htmlFor="exp-amount">{t('amount')}</label>
      <input
        id="exp-amount"
        className="amount"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={amount}
        onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
      />
      {amount !== '' && !valid && <p className="error">{t(rangeKey)}</p>}

      <p className="label" id="exp-category">{t('category')}</p>
      <div className="chips wrap" role="group" aria-labelledby="exp-category">
        {categories.map(c => (
          <button key={c} type="button" className="big" aria-pressed={category === c} onClick={() => setCategory(c)}>{catLabel(c)}</button>
        ))}
      </div>

      <label className="label" htmlFor="exp-payee">{t('paidTo')}</label>
      <input
        id="exp-payee"
        className="text"
        list="exp-payees"
        maxLength={60}
        autoComplete="off"
        placeholder={t('paidToPlaceholder')}
        value={payee}
        onChange={e => setPayee(e.target.value)}
      />
      <datalist id="exp-payees">
        {payees.map(p => <option key={p} value={p} />)}
      </datalist>

      <p className="label" id="exp-mode">{t('paidBy')}</p>
      <div className="pair" role="group" aria-labelledby="exp-mode">
        {MODES.map(m => (
          <button key={m} type="button" className="big" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(m === 'upi' ? 'upi' : source === 'counter' ? 'cashFromDrawer' : 'cash')}
          </button>
        ))}
      </div>

      <button type="submit" className="big primary" disabled={!valid || busy}>
        {busy ? t('saving') : t('saveExpense')}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
