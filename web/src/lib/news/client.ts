import type { CachedNewsArticle, NewsCacheStatus } from "./types";

export type NewsApiResponse = {
  articles: CachedNewsArticle[];
  status: NewsCacheStatus;
  message: string | null;
};

const statuses = new Set<NewsCacheStatus>([
  "fresh",
  "refreshed",
  "updating",
  "budget_exhausted",
  "stale_error",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The browser treats even our own API response as untrusted input. Keeping the
 * check here makes the News panel fail clearly instead of rendering broken data.
 */
export function parseNewsApiResponse(value: unknown): NewsApiResponse {
  if (!isObject(value) || !Array.isArray(value.articles)) {
    throw new Error("The news service returned an invalid response.");
  }
  if (typeof value.status !== "string" || !statuses.has(value.status as NewsCacheStatus)) {
    throw new Error("The news service returned an invalid status.");
  }

  const articles = value.articles.map((article) => {
    if (
      !isObject(article) ||
      typeof article.id !== "string" ||
      typeof article.title !== "string" ||
      typeof article.source !== "string" ||
      typeof article.url !== "string" ||
      typeof article.publishedAt !== "string" ||
      typeof article.fetchedAt !== "string" ||
      (article.summary !== null && typeof article.summary !== "string")
    ) {
      throw new Error("The news service returned an invalid article.");
    }

    const url = new URL(article.url);
    if (url.protocol !== "https:") {
      throw new Error("The news service returned an unsafe article link.");
    }
    if (
      Number.isNaN(new Date(article.publishedAt).valueOf()) ||
      Number.isNaN(new Date(article.fetchedAt).valueOf())
    ) {
      throw new Error("The news service returned an invalid article date.");
    }

    return {
      id: article.id,
      title: article.title,
      source: article.source,
      url: url.toString(),
      publishedAt: article.publishedAt,
      fetchedAt: article.fetchedAt,
      summary: article.summary,
    };
  });

  return {
    articles,
    status: value.status as NewsCacheStatus,
    message: typeof value.message === "string" ? value.message : null,
  };
}

export function readNewsError(value: unknown) {
  return isObject(value) && typeof value.error === "string"
    ? value.error
    : "News is temporarily unavailable.";
}
