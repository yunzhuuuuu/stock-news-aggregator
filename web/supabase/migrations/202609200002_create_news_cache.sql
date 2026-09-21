-- Stage D1: shared news cache, article-to-symbol links, refresh coordination,
-- and a daily provider-call counter. Browser clients may read public cache
-- data after signing in, but only trusted server code may write it.

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_article_id text not null,
  title text not null,
  source text not null,
  url text not null,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  summary text,

  constraint articles_provider_id_unique unique (provider, provider_article_id),
  constraint articles_url_unique unique (url),
  constraint articles_provider_present check (length(trim(provider)) > 0),
  constraint articles_provider_id_present check (length(trim(provider_article_id)) > 0),
  constraint articles_title_present check (length(trim(title)) > 0),
  constraint articles_source_present check (length(trim(source)) > 0),
  constraint articles_https_url check (url ~ '^https://'),
  constraint articles_summary_short check (summary is null or length(summary) <= 500)
);

create index articles_published_at_idx
on public.articles (published_at desc);

create table public.article_symbols (
  article_id uuid not null references public.articles(id) on delete cascade,
  symbol text not null,

  constraint article_symbols_pkey primary key (article_id, symbol),
  constraint article_symbols_symbol_format
    check (symbol = upper(symbol) and symbol ~ '^[A-Z][A-Z0-9.-]{0,5}$')
);

create index article_symbols_symbol_idx
on public.article_symbols (symbol);

create table public.news_refresh_state (
  symbol text primary key,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_eligible_at timestamptz,
  refresh_lease_until timestamptz,
  last_error text,

  constraint news_refresh_state_symbol_format
    check (symbol = upper(symbol) and symbol ~ '^[A-Z][A-Z0-9.-]{0,5}$')
);

create table public.news_api_usage (
  usage_date date primary key,
  request_count integer not null default 0,

  constraint news_api_usage_nonnegative check (request_count >= 0)
);

alter table public.articles enable row level security;
alter table public.article_symbols enable row level security;
alter table public.news_refresh_state enable row level security;
alter table public.news_api_usage enable row level security;

revoke all on table public.articles from anon, authenticated;
revoke all on table public.article_symbols from anon, authenticated;
revoke all on table public.news_refresh_state from anon, authenticated;
revoke all on table public.news_api_usage from anon, authenticated;

grant select on table public.articles to authenticated;
grant select on table public.article_symbols to authenticated;
grant select on table public.news_refresh_state to authenticated;

create policy "Signed-in users can read shared news articles"
on public.articles for select
to authenticated
using (true);

create policy "Signed-in users can read article symbol links"
on public.article_symbols for select
to authenticated
using (true);

create policy "Signed-in users can read news refresh status"
on public.news_refresh_state for select
to authenticated
using (true);

comment on table public.articles is
  'Shared article metadata and short provider-permitted summaries.';
comment on table public.article_symbols is
  'Many-to-many links between cached articles and stock symbols.';
comment on table public.news_refresh_state is
  'Per-symbol cache timing, lease, and last refresh result.';
comment on table public.news_api_usage is
  'Server-only daily counter used to enforce the internal provider budget.';
