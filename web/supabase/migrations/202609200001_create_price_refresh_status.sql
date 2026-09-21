-- Stage C: remember whether each shared symbol refreshed successfully, was
-- rejected as invalid, or failed temporarily. This lets the Dashboard explain
-- missing prices without treating an API outage as a bad user entry.

create table public.price_refresh_status (
  symbol text primary key,
  status text not null,
  message text,
  checked_at timestamptz not null default now(),

  constraint price_refresh_status_symbol_format
    check (symbol = upper(symbol) and symbol ~ '^[A-Z][A-Z0-9.-]{0,5}$'),
  constraint price_refresh_status_value
    check (status in ('ok', 'invalid_symbol', 'temporary_error'))
);

alter table public.price_refresh_status enable row level security;

revoke all on table public.price_refresh_status from anon, authenticated;
grant select on table public.price_refresh_status to authenticated;

create policy "Signed-in users can read shared price refresh status"
on public.price_refresh_status for select
to authenticated
using (true);

comment on table public.price_refresh_status is
  'Latest provider result for each shared symbol. Writes are server-only.';
