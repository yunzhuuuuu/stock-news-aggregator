import type { NewsArticleInput } from "@/lib/providers/news-types";
import type {
  CachedNewsArticle,
  NewsCacheResponse,
  NewsRefreshClaim,
} from "./types";

type NewsRefreshDependencies = {
  loadCached: () => Promise<CachedNewsArticle[]>;
  claim: () => Promise<NewsRefreshClaim>;
  fetchArticles: () => Promise<NewsArticleInput[]>;
  persist: (articles: NewsArticleInput[]) => Promise<void>;
  complete: (success: boolean, error?: string) => Promise<void>;
};

function unclaimedResponse(
  articles: CachedNewsArticle[],
  claim: NewsRefreshClaim,
): NewsCacheResponse {
  if (claim.reason === "leased") {
    return {
      articles,
      status: "updating",
      message: "Another request is updating this shared news cache.",
      requestCount: claim.requestCount,
    };
  }
  if (claim.reason === "budget_exhausted") {
    return {
      articles,
      status: "budget_exhausted",
      message: "The daily news budget is exhausted. Showing cached articles.",
      requestCount: claim.requestCount,
    };
  }
  return { articles, status: "fresh", message: null, requestCount: claim.requestCount };
}

/**
 * Provider-independent cache workflow. Cached articles are loaded first so a
 * provider failure can always fall back without blanking the News tab.
 */
export async function refreshNewsCache(
  dependencies: NewsRefreshDependencies,
): Promise<NewsCacheResponse> {
  const cached = await dependencies.loadCached();
  const claim = await dependencies.claim();
  if (!claim.claimed) return unclaimedResponse(cached, claim);

  try {
    const articles = await dependencies.fetchArticles();
    await dependencies.persist(articles);
    await dependencies.complete(true);
    return {
      articles: await dependencies.loadCached(),
      status: "refreshed",
      message: null,
      requestCount: claim.requestCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news error.";
    await dependencies.complete(false, message);
    return {
      articles: cached,
      status: "stale_error",
      message: cached.length > 0
        ? "News refresh failed. Showing the last successful cache."
        : "News is temporarily unavailable.",
      requestCount: claim.requestCount,
    };
  }
}
