export type NewsArticleInput = {
  provider: string;
  providerArticleId: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  summary: string | null;
  symbols: string[];
};

export type NewsProvider = {
  fetchArticles(symbols: string[]): Promise<NewsArticleInput[]>;
};

export type NewsProviderErrorCode = "RATE_LIMIT" | "PROVIDER_ERROR";

export class NewsProviderError extends Error {
  constructor(
    message: string,
    public readonly code: NewsProviderErrorCode,
  ) {
    super(message);
    this.name = "NewsProviderError";
  }
}
