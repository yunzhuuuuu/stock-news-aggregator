-- Stage C: shared daily closing-price cache for every user's symbols.
-- The app may read this table with a signed-in user's publishable key, but
-- browser clients cannot write prices. A later server-only provider job will
-- use protected credentials to insert or update rows.

create table public.daily_prices (
  symbol text not null,
  trading_date date not null,
  close numeric(18, 4) not null,
  currency text not null default 'USD',
  provider text not null,
  fetched_at timestamptz not null default now(),

  constraint daily_prices_pkey primary key (symbol, trading_date),
  constraint daily_prices_symbol_format
    check (symbol = upper(symbol) and symbol ~ '^[A-Z][A-Z0-9.-]{0,5}$'),
  constraint daily_prices_close_positive check (close > 0),
  constraint daily_prices_currency_format
    check (currency = upper(currency) and currency ~ '^[A-Z]{3}$'),
  constraint daily_prices_provider_present check (length(trim(provider)) > 0)
);

alter table public.daily_prices enable row level security;

revoke all on table public.daily_prices from anon, authenticated;
grant select on table public.daily_prices to authenticated;

create policy "Signed-in users can read the shared price cache"
on public.daily_prices for select
to authenticated
using (true);

comment on table public.daily_prices is
  'Shared end-of-day price cache. Writes are reserved for trusted server jobs.';
