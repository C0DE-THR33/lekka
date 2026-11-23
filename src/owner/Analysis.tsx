import { useState } from 'react'
import { useLang, useT, type Key } from '../lib/i18n'
import { formatRupees } from '../lib/money'
import { dailySummary, dailyTotals, expensesByCategory, salesByHour } from '../lib/summary'
import { useTxns } from '../lib/useTodayTxns'

const DAYS = 7

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
// Bar height in %: nothing for zero, at least a sliver for any real amount.
const barHeight = (v: number, max: number) => `${v ? Math.max(2, pct(v, max)) : 0}%`

/** "7 pm" for hour 19. */
const hourLabel = (h: number, locale: string) =>
  new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString(locale, { hour: 'numeric', timeZone: 'UTC' })

export function Analysis() {
  const t = useT()
  const locale = useLang() === 'kn' ? 'kn-IN' : 'en-IN'
  const { txns, error } = useTxns(DAYS - 1)
  const [picked, setPicked] = useState(DAYS - 1) // today

  if (error) return <p className="error">{t('loadWeekError', { error })}</p>
  if (!txns) return <p>{t('loading')}</p>

  const week = dailySummary(txns)
  if (!week.sales && !week.expenses) return <p className="muted">{t('noWeekData')}</p>

  const days = dailyTotals(txns, new Date(), DAYS)
  const hours = salesByHour(txns)
  const [topCat] = expensesByCategory(txns)
  const dayName = (day: string, weekday: 'short' | 'long' = 'short') =>
    new Date(`${day}T12:00:00+05:30`).toLocaleDateString(locale, { weekday, timeZone: 'Asia/Kolkata' })
  const fmtDay = (d: (typeof days)[number]) => ({
    day: dayName(d.day, 'long'), sales: formatRupees(d.sales), expenses: formatRupees(d.expenses), profit: formatRupees(d.sales - d.expenses),
  })

  const best = days.reduce((a, b) => (b.sales > a.sales ? b : a))
  const peak = hours.indexOf(Math.max(...hours))
  const first = hours.findIndex(h => h > 0)
  const last = 23 - [...hours].reverse().findIndex(h => h > 0)
  const open = hours.slice(first, last + 1)
  const dayMax = Math.max(1, ...days.map(d => Math.max(d.sales, d.expenses)))
  const hourMax = Math.max(1, ...open)
  const labelEvery = Math.ceil(open.length / 6) // about six hour labels, so they don't collide on a phone
  const sel = days[picked]

  return (
    <div className="overview">
      <section className="card span" aria-labelledby="trend-h">
        <div className="card-head">
          <h2 id="trend-h">{t('salesVsExpenses')} <span className="muted">· {t('last7Days')}</span></h2>
        </div>
        <dl className="legend">
          <div><dt><i className="chart-in" />{t('sales')}</dt></div>
          <div><dt><i className="chart-out" />{t('expenses')}</dt></div>
        </dl>
        <ol className="cols">
          {days.map((d, i) => (
            <li key={d.day}>
              <button
                aria-pressed={picked === i}
                aria-label={t('dayDetail', fmtDay(d))}
                title={t('dayDetail', fmtDay(d))}
                onClick={() => setPicked(i)}
              >
                <span className="plot">
                  <span className="chart-in" style={{ height: barHeight(d.sales, dayMax) }} />
                  <span className="chart-out" style={{ height: barHeight(d.expenses, dayMax) }} />
                </span>
                <span className="tick-label">{dayName(d.day)}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="readout" aria-live="polite">{t('dayDetail', fmtDay(sel))}</p>
      </section>

      <section className="card" aria-labelledby="insight-h">
        <h2 id="insight-h">{t('insights')}</h2>
        <ul className="insights">
          <li>{t('insightProfit', { profit: formatRupees(week.profit), sales: formatRupees(week.sales), margin: pct(week.profit, week.sales) })}</li>
          {best.sales > 0 && <li>{t('insightBestDay', { day: dayName(best.day, 'long'), amount: formatRupees(best.sales) })}</li>}
          {first >= 0 && <li>{t('insightBusiest', { from: hourLabel(peak, locale), to: hourLabel((peak + 1) % 24, locale) })}</li>}
          {topCat && (
            <li>{t('insightTopExpense', { category: t(`cat.${topCat[0]}` as Key), pct: pct(topCat[1], week.expenses) })}</li>
          )}
          {week.sales > 0 && <li>{t('insightUpi', { pct: pct(week.upi, week.sales) })}</li>}
        </ul>
      </section>

      {first >= 0 && (
        <section className="card" aria-labelledby="hours-h">
          <h2 id="hours-h">{t('busyHours')}</h2>
          <p className="muted">{t('busyHoursHint')}</p>
          <ol className="cols hours">
            {open.map((paise, i) => {
              const label = t('hourSales', { hour: hourLabel(first + i, locale), amount: formatRupees(paise) })
              return (
                <li key={i} aria-label={label} title={label}>
                  <span className="plot"><span className="chart-in" style={{ height: barHeight(paise, hourMax) }} /></span>
                  <span className="tick-label">{i % labelEvery ? '' : hourLabel(first + i, locale)}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
