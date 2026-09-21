import {
  NewsProviderError,
  type NewsArticleInput,
  type NewsProvider,
} from "./news-types";

const endpoint = "https://api.marketaux.com/v1/news/all";
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,5}$/;
const trackingParameters = new Set(["fbclid", "gclid"]);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedHttpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || trackingParameters.has(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function shortSummary(value: JsonObject) {
  const candidate = typeof value.snippet === "string"
    ? value.snippet
    : typeof value.description === "string"
      ? value.description
      : "";
  const trimmed = candidate.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function requestedSymbols(values: string[]) {
  const symbols = [...new Set(values.map((value) => value.trim().toUpperCase()))];
  if (symbols.length === 0 || symbols.some((symbol) => !symbolPattern.test(symbol))) {
    throw new Error("At least one valid stock symbol is required.");
  }
  return symbols;
}

/** Convert Marketaux JSON into the provider-neutral article cache shape. */
export function parseMarketauxResponse(
  symbolValues: string[],
  payload: unknown,
  fetchedAt = new Date().toISOString(),
): NewsArticleInput[] {
  const symbols = requestedSymbols(symbolValues);
  const requested = new Set(symbols);
  if (!isObject(payload)) throw new NewsProviderError(
    "Marketaux returned invalid JSON.",
    "PROVIDER_ERROR",
  );

  if (payload.error) {
    const message = isObject(payload.error) && typeof payload.error.message === "string"
      ? payload.error.message
      : "Marketaux returned an API error.";
    throw new NewsProviderError(message, "PROVIDER_ERROR");
  }
  if (!Array.isArray(payload.data)) {
    throw new NewsProviderError(
      "Marketaux returned no article list.",
      "PROVIDER_ERROR",
    );
  }

  const ids = new Set<string>();
  const urls = new Set<string>();
  const articles: NewsArticleInput[] = [];

  for (const value of payload.data) {
    if (!isObject(value)) continue;
    const providerArticleId = typeof value.uuid === "string" ? value.uuid.trim() : "";
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const url = normalizedHttpsUrl(value.url);
    const published = typeof value.published_at === "string"
      ? new Date(value.published_at)
      : null;
    if (!providerArticleId || !title || !url || !published || Number.isNaN(published.valueOf())) {
      continue;
    }

    const entitySymbols = Array.isArray(value.entities)
      ? value.entities.flatMap((entity) => {
          if (!isObject(entity) || typeof entity.symbol !== "string") return [];
          const symbol = entity.symbol.trim().toUpperCase();
          return requested.has(symbol) ? [symbol] : [];
        })
      : [];
    const matchedSymbols = [...new Set(entitySymbols)];
    if (matchedSymbols.length === 0) continue;
    if (ids.has(providerArticleId) || urls.has(url)) continue;

    let source = typeof value.source === "string" ? value.source.trim() : "";
    if (!source) source = new URL(url).hostname.replace(/^www\./, "");

    ids.add(providerArticleId);
    urls.add(url);
    articles.push({
      provider: "marketaux",
      providerArticleId,
      title,
      source,
      url,
      publishedAt: published.toISOString(),
      fetchedAt,
      summary: shortSummary(value),
      symbols: matchedSymbols,
    });
  }

  return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function createMarketauxProvider(
  apiToken: string,
  fetchImplementation: typeof fetch = fetch,
): NewsProvider {
  if (!apiToken) throw new Error("MARKETAUX_API_TOKEN is not configured.");

  return {
    async fetchArticles(symbolValues) {
      const symbols = requestedSymbols(symbolValues);
      const url = new URL(endpoint);
      url.searchParams.set("symbols", symbols.join(","));
      url.searchParams.set("filter_entities", "true");
      url.searchParams.set("must_have_entities", "true");
      url.searchParams.set("language", "en");
      url.searchParams.set("limit", "3");
      url.searchParams.set("api_token", apiToken);

      const response = await fetchImplementation(url, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (response.status === 429) {
        throw new NewsProviderError("Marketaux rate limit reached.", "RATE_LIMIT");
      }
      if (!response.ok) {
        throw new NewsProviderError(
          `Marketaux request failed with HTTP ${response.status}.`,
          "PROVIDER_ERROR",
        );
      }
      return parseMarketauxResponse(symbols, await response.json());
    },
  };
}
