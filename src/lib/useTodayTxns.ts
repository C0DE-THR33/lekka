import { useEffect, useState } from 'react'
import { listTxnsSince, subscribe, type Txn } from './db'
import { istDayStart } from './summary'

/** Today's transactions (newest first), re-loaded whenever any transaction changes. */
export const useTodayTxns = () => useTxns(0)

/** Transactions since India midnight `daysBack` days ago (newest first), kept live like useTodayTxns. */
export function useTxns(daysBack: number) {
  const [txns, setTxns] = useState<Txn[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let latest = 0
    const reload = () => {
      const call = ++latest
      listTxnsSince(new Date(istDayStart(new Date()).getTime() - daysBack * 86_400_000)).then(
        t => { if (call === latest) { setTxns(t); setError('') } },
        (e: Error) => { if (call === latest) setError(e.message) },
      )
    }
    reload()
    const unsubscribe = subscribe(reload)
    return () => {
      latest = -1 // ignore replies that arrive after unmount
      unsubscribe()
    }
  }, [daysBack])

  return { txns, error }
}
