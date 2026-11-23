-- Demo data for Rows Kitchen: 7 days ending today (Asia/Kolkata). Safe to re-run;
-- it wipes and regenerates entries so "today" always has data. UPI refs are fake (DEMO…).
-- Shaped on the interview: ~20 UPI + 5 cash per weekday (25 + 10 at weekends),
-- ₹300–₹500 orders, 3 supplier payments a day of ₹300–₹2,000.

delete from day_closes;
delete from transactions;

create temp view seed_days as
select d,
       (date_trunc('day', now() at time zone 'Asia/Kolkata') - make_interval(days => d))
         at time zone 'Asia/Kolkata' as start,
       extract(isodow from date_trunc('day', now() at time zone 'Asia/Kolkata') - make_interval(days => d)) in (6, 7) as weekend
from generate_series(0, 6) d;

-- Past days: opening hours 3:00–10:30 PM. Today: a third of the volume, in the last 3 hours (or since midnight, if sooner).
insert into transactions (direction, mode, amount_paise, source, upi_ref, occurred_at)
select 'in', m.mode,
       (300 + floor(random() * 200 / 10) * 10) * 100,
       case m.mode when 'upi' then 'simulated' else 'counter' end,
       case m.mode when 'upi' then 'DEMO' || lpad(floor(random() * 1e8)::text, 8, '0') end,
       case when s.d = 0 then now() - random() * least(now() - s.start, interval '3 hours')
            else s.start + interval '15 hours' + random() * interval '7.5 hours' end
from seed_days s
cross join lateral (values
  ('upi',  case when s.weekend then 25 else 20 end),
  ('cash', case when s.weekend then 10 else 5 end)
) m(mode, n)
cross join lateral generate_series(1, case when s.d = 0 then greatest(1, m.n / 3) else m.n end) i;

insert into transactions (direction, mode, amount_paise, category, payee, source, occurred_at)
select 'out',
       (array['cash', 'upi'])[1 + floor(random() * 2)::int],
       (300 + floor(random() * 1700 / 50) * 50) * 100,
       'Supplies',
       (array['Vegetable vendor', 'Wrap bread supplier', 'Dairy supplier', 'Gas cylinder'])[1 + floor(random() * 4)::int],
       'owner',
       case when s.d = 0 then now() - random() * least(now() - s.start, interval '3 hours')
            else s.start + interval '15 hours' + random() * interval '7.5 hours' end
from seed_days s
cross join generate_series(1, case when s.d = 0 then 1 else 3 end) i;

drop view seed_days;
