-- One-off fix for a database created with the first version of schema.sql.
-- Supabase had granted the public key DELETE and full UPDATE; this takes them back.
-- (schema.sql already includes this, so new projects don't need it.)
revoke all on transactions, day_closes from anon, authenticated;
grant select, insert on transactions to anon;
grant update (voided_at, void_reason) on transactions to anon;
grant select, insert, update on day_closes to anon;
