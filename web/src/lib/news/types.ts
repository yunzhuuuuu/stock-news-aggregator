export type CachedNewsArticle = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  summary: string | null;
};

export type NewsCacheStatus =
  | "fresh"
  | "refreshed"
  | "updating"
  | "budget_exhausted"
  | "stale_error";

export type NewsCacheResponse = {
  articles: CachedNewsArticle[];
  status: NewsCacheStatus;
  message: string | null;
  requestCount: number;
};

export type NewsRefreshClaim = {
  claimed: boolean;
  reason: "claimed" | "fresh" | "leased" | "budget_exhausted";
  requestCount: number;
};
