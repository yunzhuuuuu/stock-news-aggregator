-- Stage B: store one current position per user and stock symbol.
-- Run this file in the Supabase SQL Editor, or apply it with the Supabase CLI.

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,
  quantity numeric(18, 6) not null,
  average_cost numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint positions_symbol_format
    check (symbol = upper(symbol) and symbol ~ '^[A-Z][A-Z0-9.-]{0,5}$'),
  constraint positions_quantity_positive check (quantity > 0),
  constraint positions_average_cost_nonnegative check (average_cost >= 0),
  constraint positions_user_symbol_unique unique (user_id, symbol)
);

-- RLS makes the ownership rule part of the database. Even a buggy page query
-- cannot read another user's rows when it uses the publishable key.
alter table public.positions enable row level security;

revoke all on table public.positions from anon, authenticated;
grant select, insert, update, delete on table public.positions to authenticated;

create policy "Users can read their own positions"
on public.positions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own positions"
on public.positions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own positions"
on public.positions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own positions"
on public.positions for delete
to authenticated
using ((select auth.uid()) = user_id);

create index positions_user_id_idx on public.positions(user_id);

-- Keep updated_at accurate without relying on every app caller to remember it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger positions_set_updated_at
before update on public.positions
for each row execute function public.set_updated_at();
