import { useState } from 'react'
import { ExpenseForm } from '../counter/Expenses'
import { useT } from '../lib/i18n'
import { Analysis } from './Analysis'
import { CloseDay } from './CloseDay'
import { Today } from './Today'
import { Transactions } from './Transactions'

// Short labels so four tabs fit on a phone. Expenses are entered at the counter, where they're paid.
const VIEWS = [['today', 'tab.today'], ['entries', 'tab.entries'], ['analysis', 'tab.analysis'], ['close', 'tab.close']] as const
type View = (typeof VIEWS)[number][0]

export function Owner() {
  const t = useT()
  const [view, setView] = useState<View>('today')

  const go = (v: View) => {
    setView(v)
    scrollTo(0, 0) // shortcuts sit at the bottom of Today
  }

  return (
    <>
      <nav className="tabs">
        {VIEWS.map(([v, label]) => (
          <button key={v} aria-pressed={view === v} onClick={() => go(v)}>{t(label)}</button>
        ))}
      </nav>
      {view === 'today' && <Today onOpen={go} />}
      {view === 'entries' && <><MonthlyBill /><Transactions /></>}
      {view === 'analysis' && <Analysis />}
      {view === 'close' && <CloseDay />}
    </>
  )
}

/** Rent, salary and other bills the owner pays away from the shop. Day-to-day spending is entered at the counter. */
function MonthlyBill() {
  const t = useT()
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState('')
  return (
    <>
      <details className="bill">
        <summary className="big">{t('addMonthlyBill')}</summary>
        <ExpenseForm key={formKey} source="owner" onSaved={m => { setNotice(m); setFormKey(formKey + 1) }} />
      </details>
      {notice && <p className="ok" role="status">{notice}</p>}
    </>
  )
}
