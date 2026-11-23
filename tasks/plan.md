# Implementation Plan: Lekka (class demo)

Spec: [SPEC.md](../SPEC.md) (approved). Task details: [todo.md](todo.md). This replaces the earlier real-pilot plan.

## Overview
One Vite + React web app with two screens sharing a Supabase database: the counter app (`/#/counter`) for workers and the owner app (`/#/owner`) for Ashwin and Adrien. There is no sign-in and one shop (Rows Kitchen). UPI payments come from a "Simulate UPI" button. Done means the 7-step demo script in SPEC.md runs on two phones.

## Architecture Decisions
- **One app, two hash routes.** `main.tsx` reads `location.hash` and renders Counter or Owner. No router library.
- **Supabase Realtime for live sync.** Both apps subscribe to inserts and updates on `transactions` and re-run `dailySummary()` on the day's rows. At ~30 entries a day, re-querying the whole day on each change is simpler than patching state.
- **Pure money logic in `src/lib/summary.ts`.** `dailySummary`, `reconcile` and `istDayStart` are the only tested code; screens stay thin.
- **Demo-only open database policies.** The anon key may read and write both tables. This is acceptable only because the data is fake, and SPEC.md says so.
- **Sound needs one tap.** Browsers block audio until the user interacts, so the counter opens with a "Start shift" button that unlocks the chime.

## Dependency graph
```
T1 project + schema + seed + two routes
 └─ T2 owner Today dashboard
     └─ T3 Simulate UPI + live updates   ← riskiest, proves Realtime
         ├─ T4 counter: live UPI feed ─ T5 counter: cash sale / expense
         └─ T6 owner: add expense ─ T7 owner: transactions + void ─ T8 close the day
T9 Kannada (after T5 and T8) ─ T10 README + rehearsal
```
After T3, the counter track (T4–T5) and the owner track (T6–T8) touch different files and can be built in parallel.

## Task List
### Phase 1: Shared foundation
- [x] T1: App runs with counter and owner routes (Supabase or mock)
- [x] T2: Owner Today shows Rows' seeded totals for today
- [x] T3: "Simulate UPI" adds a payment; Today updates live in another tab (mock; device test needs Supabase)
### Checkpoint 1: Realtime works across two browsers — passed on Supabase 2026-11-03 (UPI reached the counter in under 3 s; sale, expense, void and close all saved)

### Phase 2: Counter app
- [x] T4: Counter shows each UPI payment live with a chime
- [x] T5: Counter records a cash sale or cash expense; the owner sees it
### Checkpoint 2: Demo steps 1–2 on two phones

### Phase 3: Owner app
- [x] T6: Owner adds an expense or supplier payment
- [x] T7: Owner sees today's transactions and voids a wrong one
- [x] T8: Owner closes the day; cash and UPI gaps are flagged and saved
### Checkpoint 3: Demo steps 3–5

### Phase 4: Finish
- [x] T9: English / Kannada toggle on both apps (Kannada is machine-translated; see src/i18n/kn.json)
- [ ] T10: README (done) and rehearse the full demo on the phone + laptop (team)
### Checkpoint 4: All 7 demo steps pass with the owner on the phone and the counter on the laptop

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Realtime not enabled on the table, so nothing updates live | High | `schema.sql` adds `transactions` to the `supabase_realtime` publication; T3 proves it before anything else depends on it |
| Phone blocks the chime | Medium | "Start shift" tap unlocks audio (T4); the banner still shows without sound |
| Wrong "today" near midnight (UTC vs IST) | Medium | `istDayStart()` is tested; every day query uses it |
| College Wi-Fi blocks phone-to-laptop traffic | Medium | Connect the laptop to the phone's hotspot; works on plain `http://` (tested) |
| Anyone with the URL can write data | Low (fake data) | Demo-only policies, noted in SPEC.md; no real data ever entered |
| Kannada text is wrong | Low | Marked as machine-translated unless a teammate checks it |

## Defaults taken for the spec's open questions
1. Simulate UPI is a button in the owner app.
2. The counter can record small cash expenses.
3. Kannada text is machine-translated and marked as such until a teammate checks it.
4. Hosting: served from the laptop, no public deployment (decided 2026-11-03).
