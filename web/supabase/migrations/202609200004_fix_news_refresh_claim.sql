-- Stage D2 fix: the original return column name matched news_api_usage.request_count,
-- which made PostgreSQL treat that reference as ambiguous. Recreate the function
-- with an unambiguous public result name and qualified table columns.

drop function if exists public.claim_news_refresh(text, timestamptz, integer, integer);

create function public.claim_news_refresh(
  p_symbol text,
  p_now timestamptz default now(),
  p_lease_seconds integer default 30,
  p_daily_limit integer default 90
)
returns table (claimed boolean, reason text, usage_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_eligible_at timestamptz;
  v_lease_until timestamptz;
  v_usage_date date := (p_now at time zone 'UTC')::date;
  v_request_count integer;
begin
  if p_symbol is null or p_symbol <> upper(p_symbol)
     or p_symbol !~ '^[A-Z][A-Z0-9.-]{0,5}$' then
    raise exception 'Invalid stock symbol';
  end if;
  if p_lease_seconds < 1 or p_daily_limit < 1 then
    raise exception 'Lease seconds and daily limit must be positive';
  end if;

  insert into public.news_refresh_state (symbol)
  values (p_symbol)
  on conflict (symbol) do nothing;

  select state.next_eligible_at, state.refresh_lease_until
  into v_next_eligible_at, v_lease_until
  from public.news_refresh_state as state
  where state.symbol = p_symbol
  for update;

  select coalesce(usage.request_count, 0)
  into v_request_count
  from public.news_api_usage as usage
  where usage.usage_date = v_usage_date;
  v_request_count := coalesce(v_request_count, 0);

  if v_next_eligible_at is not null and v_next_eligible_at > p_now then
    return query select false, 'fresh'::text, v_request_count;
    return;
  end if;
  if v_lease_until is not null and v_lease_until > p_now then
    return query select false, 'leased'::text, v_request_count;
    return;
  end if;

  v_request_count := null;
  insert into public.news_api_usage (usage_date, request_count)
  values (v_usage_date, 1)
  on conflict (usage_date) do update
    set request_count = public.news_api_usage.request_count + 1
    where public.news_api_usage.request_count < p_daily_limit
  returning public.news_api_usage.request_count into v_request_count;

  if v_request_count is null then
    select usage.request_count into v_request_count
    from public.news_api_usage as usage
    where usage.usage_date = v_usage_date;
    return query select false, 'budget_exhausted'::text, v_request_count;
    return;
  end if;

  update public.news_refresh_state as state
  set last_attempt_at = p_now,
      refresh_lease_until = p_now + make_interval(secs => p_lease_seconds)
  where state.symbol = p_symbol;

  return query select true, 'claimed'::text, v_request_count;
end;
$$;

revoke all on function public.claim_news_refresh(text, timestamptz, integer, integer)
from public, anon, authenticated;

grant execute on function public.claim_news_refresh(text, timestamptz, integer, integer)
to service_role;

comment on function public.claim_news_refresh(text, timestamptz, integer, integer) is
  'Atomically checks freshness and leases, reserves one daily API request, then grants one refresh worker.';
