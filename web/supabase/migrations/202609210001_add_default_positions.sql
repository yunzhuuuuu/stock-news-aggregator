-- Give every existing and future account the same three starter holdings.
-- Existing rows win: ON CONFLICT prevents this migration from replacing a
-- user's AAPL, META, or TSLA quantity and average cost.

create or replace function public.add_default_positions_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.positions (user_id, symbol, quantity, average_cost)
  values
    (new.id, 'AAPL', 15, 200),
    (new.id, 'META', 15, 700),
    (new.id, 'TSLA', 15, 400)
  on conflict (user_id, symbol) do nothing;

  return new;
end;
$$;

drop trigger if exists add_default_positions_after_signup on auth.users;

create trigger add_default_positions_after_signup
after insert on auth.users
for each row execute function public.add_default_positions_for_user();

-- Backfill every account that already exists when this migration is applied.
insert into public.positions (user_id, symbol, quantity, average_cost)
select
  users.id,
  starter.symbol,
  starter.quantity,
  starter.average_cost
from auth.users as users
cross join (
  values
    ('AAPL'::text, 15::numeric, 200::numeric),
    ('META'::text, 15::numeric, 700::numeric),
    ('TSLA'::text, 15::numeric, 400::numeric)
) as starter(symbol, quantity, average_cost)
on conflict (user_id, symbol) do nothing;
