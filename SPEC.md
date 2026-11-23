# Spec: Lekka (class demo)

Banking Technology Lab, Group 9. Source material: `Rows_Kitchen_Interview_Report.docx` and the Group 9 persona deck (prototype on slides 21–24).

## Assumptions
1. **Class demo, not a live product.** Real UPI payments are not captured. A "Simulate UPI payment" button creates realistic UPI entries.
2. **Two apps, one codebase.** The counter app (`/#/counter`) and the owner app (`/#/owner`) are two screens of one web app, sharing one database. Each phone opens its own URL and saves it to the home screen.
3. **No sign-in.** Hiding profit from counter staff is done by the UI only, which is fine for a demo and not fine with real money.
4. **Supabase is the shared backend** (Postgres + Realtime), so a payment on one phone shows on the other within seconds.
5. **One shop: Rows Kitchen.** No shop picker or switcher. The demo data is shaped on Rows' numbers: ₹300–₹500 orders, about 20 UPI and 5 cash per weekday. Smoocho or Choc shop would each run their own copy with their own Supabase project. Owners with several shops (one view across all of them) are **pitched in the deck, not built** (decided 2026-11-03).

## Objective
Show that one simple app removes the daily pain the interviews found: shops record UPI, cash and expenses by hand and match them at night (Rows' biggest time sink), and counter workers can't see UPI payments arrive, so they rely on customer screenshots (Smoocho).

**Counter app (workers):**
- Sees each UPI payment arrive live: large amount, the last 4 digits of the UPI ref (to match the customer's screen), a sound.
- A count strip ("Today · 13 UPI · 6 cash sales"): counts only, never rupee totals.
- **Payments tab:** records a cash sale in two taps (amount, then "Cash sale"); lists the last 10 UPI payments and the worker's cash sales, with any sale the owner voided struck through with the owner's reason.
- **Expenses tab:** everything the shop pays out is entered here, where it's paid: amount, category (Supplies, Utilities, Other), optional payee, paid by cash from the drawer or UPI. Lists today's counter expenses; the worker can void a wrong one with a reason. (Workers can't void sales; voiding an expense only raises the expected drawer cash.)
- Shows **no** totals for sales, expenses or profit.
- English / Kannada toggle.

**Owner app (Ashwin and Adrien):**
- **Today:** sales (UPI + cash + card), UPI, cash, expenses, estimated profit (sales − expenses) for today.
- **Transactions:** today's list with the source (counter, owner, simulated UPI). Void a wrong entry with a reason; it stays visible, struck through, and drops out of totals.
- **Analysis:** last 7 days of sales vs expenses as bars (tap a day for its figures), plain-sentence insights (7-day profit and margin, best day, busiest hour, biggest expense, UPI share), and sales by hour of day.
- **Monthly bill** (top of Entries, folded away): rent, salary, utilities or other, up to ₹10,00,000, optional payee, paid by cash or UPI. Day-to-day spending is entered at the counter, where the owner isn't (decided 2026-11-03). A bill counts in full on the day it's entered, so that day shows a loss.
- **Close the day:** enter cash counted in the drawer and the UPI total shown in the bank app. The app shows expected vs actual for both and flags each gap ("Cash short ₹150"). Expected drawer cash = cash sales − cash expenses entered at the counter (owners pay cash from money they withdraw themselves).
- **Simulate UPI payment** button (demo only): random ₹150–₹500, with a fake UPI reference.
- English / Kannada toggle.

**Out of scope:** sign-in and roles, more than one shop, real UPI/SMS/bank capture, card machines, Swiggy/Zomato, udhaar reminders, subscription billing, offline mode, month reports, "money in transit".

## Tech Stack
- Vite 6, React 19, TypeScript 5
- `@supabase/supabase-js` 2 (Postgres + Realtime), free tier
- Vitest 3 for unit tests
- Hosting: served from the laptop (`npm run dev -- --host`); the phone opens the laptop's network address. No public deployment (decided 2026-11-03).

**Mock mode:** without `.env.local`, `src/lib/db.ts` serves mock data kept in this browser only, so the app can be built and shown before Supabase is set up. Live sync between two phones needs Supabase.

No other dependencies. No router library (two hash routes), no i18n library (two JSON dictionaries), no UI kit (plain CSS).

## Data model
```sql
create table transactions (
  id           uuid primary key default gen_random_uuid(),
  direction    text not null check (direction in ('in','out')),
  mode         text not null check (mode in ('upi','cash','card')),
  amount_paise bigint not null check (amount_paise > 0),
  category     text,                -- expenses only
  payee        text,                -- supplier payments
  source       text not null check (source in ('counter','owner','simulated')),
  upi_ref      text,
  occurred_at  timestamptz not null default now(),
  voided_at    timestamptz,
  void_reason  text
);

create table day_closes (
  day                date primary key,  -- Asia/Kolkata
  counted_cash_paise bigint not null,
  bank_upi_paise     bigint not null,
  closed_at          timestamptz not null default now()
);
```
Money is whole paise. A "day" is the calendar day in `Asia/Kolkata`. Rows are never deleted.

## Commands
```
Install:   npm install
Dev:       npm run dev -- --host        # open on phones on the same Wi-Fi
Test:      npm test                     # vitest run
Build:     npm run build
DB setup:  paste supabase/schema.sql then supabase/seed.sql into the Supabase SQL editor
Config:    .env.local → VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## Project Structure
```
SPEC.md
supabase/schema.sql      → tables + demo-only open policies
supabase/seed.sql        → a week of Rows-like sample entries
src/main.tsx             → picks Counter or Owner from the hash
src/lib/db.ts            → Supabase client + the few queries/inserts
src/lib/mockDb.ts        → in-browser stand-in when .env.local is missing
src/lib/money.ts         → paise ↔ ₹ formatting (Indian grouping)
src/lib/summary.ts       → dailySummary(), reconcile(); pure, tested
src/lib/i18n.ts          → t() + en.json / kn.json
src/counter/Counter.tsx  → counter app
src/counter/Expenses.tsx → counter expense tab
src/owner/*.tsx          → Today, Transactions, Analysis, CloseDay
src/**/*.test.ts         → tests next to the code they test
```

## Code Style
```ts
// src/lib/summary.ts: pure functions, integer paise, no classes
export type Txn = {
  direction: 'in' | 'out'
  mode: 'upi' | 'cash' | 'card'
  amount_paise: number
  voided_at: string | null
}

export function dailySummary(txns: Txn[]) {
  const live = txns.filter(t => !t.voided_at)
  const sum = (f: (t: Txn) => boolean) =>
    live.filter(f).reduce((s, t) => s + t.amount_paise, 0)
  const sales = sum(t => t.direction === 'in')
  const expenses = sum(t => t.direction === 'out')
  return {
    sales,
    upi: sum(t => t.direction === 'in' && t.mode === 'upi'),
    cash: sum(t => t.direction === 'in' && t.mode === 'cash'),
    expenses,
    profit: sales - expenses,
  }
}
```
- Function components, named exports, `camelCase` functions, `snake_case` only for DB column names.
- Display money only through `formatRupees()` (₹1,25,000 style).
- All user-visible text goes through `t()`.

## Testing Strategy
- **Unit (Vitest):** `dailySummary`, `reconcile`, `formatRupees`, the IST day boundary, and that every `en.json` key exists in `kn.json`. These hold the money logic, so they must be covered.
- **No component or e2e tests.** The UI is checked by hand with the demo script below.
- **Manual demo run on two phones** before each checkpoint.

## Boundaries
- **Always:** store money as integer paise; exclude voided entries from totals; run `npm test` before committing; put new UI text in both dictionaries.
- **Ask first:** adding any dependency; changing the schema; adding sign-in; changing what the counter app shows.
- **Never:** put real bank data, real account numbers or real customer details in the app or seed; commit `.env.local` or the Supabase service-role key; hard-delete transactions.

## Success Criteria (the demo script)
On two phones, one on `/#/counter` and one on `/#/owner`:
1. Owner taps **Simulate UPI**: the counter phone shows "₹___ received · UPI" with a sound within 3 seconds, and the owner's Today UPI and Sales totals rise by the same amount.
2. The counter records a ₹200 cash sale in two taps, and the owner's Cash total rises by ₹200 within 3 seconds.
3. The counter adds a ₹1,200 supplier payment on its Expenses tab (Supplies, payee "Vegetable vendor", UPI); the owner's Expenses and Estimated profit update.
4. The owner voids the ₹200 cash sale with a reason; it shows struck through and the totals drop back.
5. **Close the day** with counted cash ₹150 below expected flags "Cash short ₹150" and saves the close.
6. The Kannada toggle switches every label on both apps.
7. `npm test` passes; `npm run build` succeeds; the phone loads the owner app from the laptop's network address.

## Open Questions
1. **Who presses "Simulate UPI" during the demo?** The default is a button in the owner app. Alternative: a third hidden `/#/demo` page on a laptop, so it looks like a customer paying.
2. **Can the counter record expenses?** Assumed yes (cash only, small purchases). Say no if only owners should.
3. **Kannada text:** can a teammate who reads Kannada check the translations? Otherwise they'll be machine-translated and marked as such.
4. **Hosting:** decided: served from the laptop, no deployment. If the classroom Wi-Fi blocks the phone, connect the laptop to the phone's hotspot.
