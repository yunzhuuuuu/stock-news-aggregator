-- Stage D2: atomic cache lease and daily API-budget reservation. These
-- functions are callable only by the service role, never by browser clients.

create or replace function public.claim_news_refresh(
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

  select next_eligible_at, refresh_lease_until
  into v_next_eligible_at, v_lease_until
  from public.news_refresh_state
  where symbol = p_symbol
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

  update public.news_refresh_state
  set last_attempt_at = p_now,
      refresh_lease_until = p_now + make_interval(secs => p_lease_seconds)
  where symbol = p_symbol;

  return query select true, 'claimed'::text, v_request_count;
end;
$$;

create or replace function public.complete_news_refresh(
  p_symbol text,
  p_success boolean,
  p_error text default null,
  p_now timestamptz default now(),
  p_cache_seconds integer default 300,
  p_failure_retry_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_cache_seconds < 1 or p_failure_retry_seconds < 1 then
    raise exception 'Cache and retry seconds must be positive';
  end if;

  update public.news_refresh_state
  set last_attempt_at = p_now,
      last_success_at = case when p_success then p_now else last_success_at end,
      next_eligible_at = p_now + make_interval(
        secs => case when p_success then p_cache_seconds else p_failure_retry_seconds end
      ),
      refresh_lease_until = null,
      last_error = case when p_success then null else left(coalesce(p_error, 'Unknown error'), 500) end
  where symbol = p_symbol;
end;
$$;

revoke all on function public.claim_news_refresh(text, timestamptz, integer, integer)
from public, anon, authenticated;
revoke all on function public.complete_news_refresh(text, boolean, text, timestamptz, integer, integer)
from public, anon, authenticated;

grant execute on function public.claim_news_refresh(text, timestamptz, integer, integer)
to service_role;
grant execute on function public.complete_news_refresh(text, boolean, text, timestamptz, integer, integer)
to service_role;

comment on function public.claim_news_refresh(text, timestamptz, integer, integer) is
  'Atomically checks freshness and leases, reserves one daily API request, then grants one refresh worker.';
comment on function public.complete_news_refresh(text, boolean, text, timestamptz, integer, integer) is
  'Releases a news refresh lease and records success or a short retry delay.';
