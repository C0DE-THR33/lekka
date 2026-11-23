# Task List: Lekka (class demo)

Spec: `SPEC.md`. Commands: `npm test`, `npm run build`, `npm run dev -- --host`.
Every task is done only when `npm test` passes, `npm run build` is clean, and the manual check was done at phone width.

---

## Phase 1: Shared foundation

### Task 1: App runs with counter and owner routes
**Description:** Scaffold Vite + React + TS + Vitest. Write `supabase/schema.sql` (tables from SPEC.md, demo-only open policies, `transactions` added to the `supabase_realtime` publication) and `supabase/seed.sql` (7 days of Rows-like entries: ₹300–₹500, ~20 UPI + 5 cash a day, 3 supplier payments). `main.tsx` routes `#/counter` and `#/owner` for Rows Kitchen. Without `.env.local`, `mockDb.ts` stands in for Supabase.

**Acceptance criteria:**
- [x] Both SQL files run cleanly in the Supabase SQL editor (run 2026-11-03; permissions fix in supabase/fix-permissions.sql)
- [x] `/#/owner` and `/#/counter` open their screens with "Rows Kitchen" in the header (mock mode)
- [x] Without `.env.local` the app runs on mock data and says so

**Verification:**
- [x] `npm run build`
- [x] Manual: open both routes (mock mode and Supabase)

**Dependencies:** None
**Files likely touched:** `package.json`, `supabase/schema.sql`, `supabase/seed.sql`, `src/main.tsx`, `src/lib/db.ts`
**Estimated scope:** M

### Task 2: Owner Today shows today's totals
**Description:** `istDayStart(now)` and `dailySummary(txns)` in `src/lib/summary.ts`; `formatRupees(paise)` in `src/lib/money.ts`. Owner Today loads the shop's transactions since IST midnight and shows Sales, UPI, Cash, Expenses and Estimated profit, laid out like slide 23.

**Acceptance criteria:**
- [x] Totals match a hand sum of today's seeded rows (mock data, all 3 shops)
- [x] Voided rows and yesterday's rows (IST) are excluded
- [x] Amounts show as ₹1,25,000 style

**Verification:**
- [ ] `npm test`: `summary.test.ts` (mixed modes, voided, 23:59 vs 00:01 IST), `money.test.ts`

**Dependencies:** T1
**Files likely touched:** `src/lib/summary.ts`, `src/lib/summary.test.ts`, `src/lib/money.ts`, `src/lib/money.test.ts`, `src/owner/Today.tsx`
**Estimated scope:** M

### Task 3: Simulate UPI and live updates
**Description:** A "Simulate UPI" button on owner Today inserts `direction=in, mode=upi, source=simulated`, a random ₹150–₹500 and a fake `upi_ref`. A `useTodayTxns()` hook loads the day and re-loads on any Realtime change to `transactions`, so every open screen stays current.

**Acceptance criteria:**
- [x] Pressing Simulate UPI raises UPI and Sales by the same amount
- [x] A second browser updates within 3 s without a refresh (mock mode: two tabs; re-check on two phones with Supabase)

**Verification:**
- [x] Manual: two browser tabs side by side (mock mode)

**Dependencies:** T2
**Files likely touched:** `src/lib/db.ts`, `src/lib/useTodayTxns.ts`, `src/owner/Today.tsx`
**Estimated scope:** S

### Checkpoint 1
- [ ] Tests pass, build clean
- [ ] Live update works across two browsers (and ideally a phone on `--host`)

---

## Phase 2: Counter app

### Task 4: Counter shows each UPI payment live with a chime
**Description:** The counter opens on a "Start shift" button (unlocks audio). After that it shows the newest incoming UPI payment as a large banner ("₹350 received · UPI · 3:42 PM") and a list of the last 10, and plays a short chime for each new one. No totals, no expenses, no profit.

**Acceptance criteria:**
- [x] A Simulate UPI on the owner phone appears on the counter within 3 s with a chime (mock mode: two tabs)
- [x] The counter shows no profit, expense or sales totals
- [x] Reloading the page keeps the last 10 payments

**Verification:**
- [ ] Manual: owner and counter on two phones

**Dependencies:** T3
**Files likely touched:** `src/counter/Counter.tsx` (chime made with Web Audio, no sound file)
**Estimated scope:** S

### Task 5: Counter records a cash sale or cash expense
**Description:** An amount field (phone number keypad via `inputMode="numeric"`, no custom pad) with "Cash sale" and "Cash expense" buttons. An expense asks for a category chip (Supplies, Utilities, Other). Inserts use `source=counter`. A confirmation shows "₹200 cash sale saved".

**Acceptance criteria:**
- [x] A cash sale takes one tap after typing the amount; an expense takes two (type, then category)
- [x] The owner's Cash (or Expenses) total updates within 3 s (mock mode: two tabs)
- [x] Empty or zero amounts can't be saved (also: letters dropped, over ₹1,00,000 rejected)

**Verification:**
- [ ] Manual: demo steps 1–2 on two phones

**Dependencies:** T4
**Files likely touched:** `src/counter/Counter.tsx`, `src/counter/CashEntry.tsx`
**Estimated scope:** S

### Checkpoint 2
- [ ] Demo steps 1–2 pass on two phones

---

## Phase 3: Owner app

### Task 6: Owner adds an expense or supplier payment
**Description:** The Add expense screen: amount, category (Supplies, Salary, Rent, Utilities, Other), optional payee (suggests the last 5 used), paid by Cash or UPI. Inserts use `source=owner`.

**Acceptance criteria:**
- [x] A ₹1,200 Supplies payment to "Vegetable vendor" by UPI lowers Estimated profit by ₹1,200
- [x] Payees used before are suggested (native `<datalist>`)
- [x] Zero or empty amounts are rejected (limit ₹10,00,000)

**Verification:**
- [x] Manual: demo step 3 (mock mode)

**Dependencies:** T3
**Files likely touched:** `src/owner/AddExpense.tsx`, `src/owner/Owner.tsx`, `src/lib/db.ts`
**Estimated scope:** S

### Task 7: Owner sees today's transactions and voids one
**Description:** A list of today's entries, newest first: time, amount, mode, category/payee, source. Tapping one offers "Void" with a required reason; voided entries stay listed, struck through, with the reason.

**Acceptance criteria:**
- [x] Voiding needs a reason and sets `voided_at`
- [x] The voided entry stays visible and drops out of every total, on both apps (mock mode: two tabs)
- [x] A voided entry can't be voided again (UI disables it; the update also requires `voided_at is null`)

**Verification:**
- [ ] `npm test` (dailySummary ignores voided rows, already in T2)
- [x] Manual: demo step 4 (mock mode)

**Dependencies:** T3
**Files likely touched:** `src/owner/Transactions.tsx`, `src/owner/Owner.tsx`, `src/lib/db.ts`
**Estimated scope:** S

### Task 8: Owner closes the day
**Description:** Pure `reconcile({summary, countedCash, bankUpi})` returns expected drawer cash (cash sales − cash expenses entered at the counter; owners pay cash from money they withdraw themselves), cash gap and UPI gap. The Close the day screen takes counted cash and the bank app's UPI total, shows a tick or "Cash short ₹150" / "UPI over ₹50" for each, and saves to `day_closes`. A day already closed shows its saved result.

**Acceptance criteria:**
- [x] Matching figures show ticks; mismatches show the exact gap and whether it's short or over
- [x] The close is saved and shown again on reload (mock mode)
- [x] Closing the same day twice updates the saved close instead of failing

**Verification:**
- [x] `npm test`: `reconcile` cases (match, short, over, no cash) + counter-only drawer rule
- [x] Manual: demo step 5 (mock mode)

**Dependencies:** T3
**Files likely touched:** `src/lib/summary.ts`, `src/lib/summary.test.ts`, `src/owner/CloseDay.tsx`, `src/owner/Owner.tsx`
**Estimated scope:** M

### Checkpoint 3
- [ ] Demo steps 3–5 pass
- [ ] Review the app with the team before polish

---

## Phase 4: Finish

### Task 9: English / Kannada toggle
**Description:** `t(key)` over `en.json` / `kn.json`; a toggle on both apps, remembered in `localStorage`. Move every visible string into the dictionaries. Mark the Kannada as machine-translated unless a teammate has checked it.

**Acceptance criteria:**
- [x] Every label on both apps switches language (checked: no English left on any screen except UPI, the shop name and typed-in data)
- [x] Rupee amounts keep Indian grouping in both languages

**Verification:**
- [x] `npm test`: every `en.json` key exists in `kn.json` with the same placeholders
- [x] Manual: demo step 6 (both apps, phone widths 320–375px)

**Dependencies:** T5, T8
**Files likely touched:** `src/lib/i18n.ts`, `src/lib/i18n.test.ts`, `src/i18n/en.json`, `src/i18n/kn.json`, screens (string swaps)
**Estimated scope:** M

### Task 10: README and rehearse (served from the laptop)
**Description:** Decided 2026-11-03: no public deployment. The laptop runs `npm run dev -- --host` and shows the counter; the owner's phone opens the laptop's network address. Write `README.md` (setup, demo setup, demo script, what is simulated). Re-run `seed.sql` before the demo, then rehearse the demo script on the real phone and laptop.

**Acceptance criteria:**
- [x] `README.md` covers setup, the laptop + phone demo setup, the demo script and what is simulated
- [x] Works on a plain `http://` network address, as the phone will open it (fixed `crypto.randomUUID`; live updates checked both ways)
- [x] Supabase secret key is in no project file and not in the build; `.env.local` is git-ignored
- [ ] The real phone loads the owner app from the laptop (team to check: firewall, Wi-Fi isolation)
- [ ] All 7 demo steps in SPEC.md pass in one run on the phone and laptop (team rehearsal)

**Verification:**
- [x] `npm test`, `npm run build`
- [ ] Manual: full rehearsal, timed

**Dependencies:** T9
**Files likely touched:** `README.md`
**Estimated scope:** S

### Checkpoint 4: Complete
- [ ] All 7 success criteria in SPEC.md met (step 7 needs the real phone)
- [ ] Ready to present
