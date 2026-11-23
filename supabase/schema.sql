-- Lekka schema (one shop per Supabase project). Run once in the SQL editor.

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
create index on transactions (occurred_at);

create table day_closes (
  day                date primary key,  -- Asia/Kolkata
  counted_cash_paise bigint not null,
  bank_upi_paise     bigint not null,
  closed_at          timestamptz not null default now()
);

-- DEMO ONLY: anyone with the anon (publishable) key can read and add rows.
-- Fine for fake data; never put real bank or customer data in this database.
alter table transactions enable row level security;
alter table day_closes   enable row level security;
create policy demo_open on transactions for all to anon using (true) with check (true);
create policy demo_open on day_closes   for all to anon using (true) with check (true);
-- Supabase grants everything on new tables by default, so take it all back first.
revoke all on transactions, day_closes from anon, authenticated;
grant select, insert on transactions to anon;
-- Transactions are never deleted or edited, only voided.
grant update (voided_at, void_reason) on transactions to anon;
grant select, insert, update on day_closes to anon;

-- Live updates for both apps.
alter publication supabase_realtime add table transactions;
