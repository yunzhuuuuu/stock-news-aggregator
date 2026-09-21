import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsArticleInput } from "@/lib/providers/news-types";
import type { CachedNewsArticle, NewsRefreshClaim } from "./types";

type ArticleRow = {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  fetched_at: string;
  summary: string | null;
};

export async function loadCachedNewsArticles(
  supabase: SupabaseClient,
  symbol: string,
): Promise<CachedNewsArticle[]> {
  const { data: links, error: linkError } = await supabase
    .from("article_symbols")
    .select("article_id")
    .eq("symbol", symbol)
    .limit(50);
  if (linkError) throw new Error(linkError.message);

  const articleIds = [...new Set((links ?? []).map((link) => String(link.article_id)))];
  if (articleIds.length === 0) return [];

  const { data, error } = await supabase
    .from("articles")
    .select("id,title,source,url,published_at,fetched_at,summary")
    .in("id", articleIds)
    .order("published_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);

  return ((data ?? []) as ArticleRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source,
    url: row.url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    summary: row.summary,
  }));
}

export async function persistNewsArticles(
  supabase: SupabaseClient,
  articles: NewsArticleInput[],
) {
  if (articles.length === 0) return;

  const { data, error } = await supabase
    .from("articles")
    .upsert(
      articles.map((article) => ({
        provider: article.provider,
        provider_article_id: article.providerArticleId,
        title: article.title,
        source: article.source,
        url: article.url,
        published_at: article.publishedAt,
        fetched_at: article.fetchedAt,
        summary: article.summary,
      })),
      { onConflict: "provider,provider_article_id" },
    )
    .select("id,provider_article_id");
  if (error) throw new Error(error.message);

  const ids = new Map(
    (data ?? []).map((row) => [String(row.provider_article_id), String(row.id)]),
  );
  const links = articles.flatMap((article) => {
    const articleId = ids.get(article.providerArticleId);
    return articleId
      ? article.symbols.map((symbol) => ({ article_id: articleId, symbol }))
      : [];
  });
  if (links.length === 0) return;

  const { error: linkError } = await supabase
    .from("article_symbols")
    .upsert(links, { onConflict: "article_id,symbol" });
  if (linkError) throw new Error(linkError.message);
}

export async function claimNewsRefresh(
  supabase: SupabaseClient,
  symbol: string,
): Promise<NewsRefreshClaim> {
  const { data, error } = await supabase.rpc("claim_news_refresh", {
    p_symbol: symbol,
    p_now: new Date().toISOString(),
    p_lease_seconds: 30,
    p_daily_limit: 90,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("The news refresh lease returned no result.");

  return {
    claimed: Boolean(row.claimed),
    reason: String(row.reason) as NewsRefreshClaim["reason"],
    requestCount: Number(row.usage_count ?? 0),
  };
}

export async function completeNewsRefresh(
  supabase: SupabaseClient,
  symbol: string,
  success: boolean,
  error?: string,
) {
  const { error: databaseError } = await supabase.rpc("complete_news_refresh", {
    p_symbol: symbol,
    p_success: success,
    p_error: error ?? null,
    p_now: new Date().toISOString(),
    p_cache_seconds: 300,
    p_failure_retry_seconds: 60,
  });
  if (databaseError) throw new Error(databaseError.message);
}
