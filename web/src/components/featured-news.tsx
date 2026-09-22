"use client";

import { useEffect, useState } from "react";
import {
  parseNewsApiResponse,
  readNewsError,
  type NewsApiResponse,
} from "@/lib/news/client";

type Article = NewsApiResponse["articles"][number];
type FeaturedResult = {
  symbol: string;
  article: Article | null;
  error: string | null;
};

const articleDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export default function FeaturedNews({ symbols }: { symbols: string[] }) {
  const symbolKey = symbols.join(",");
  const [results, setResults] = useState<FeaturedResult[]>([]);
  const [loading, setLoading] = useState(symbols.length > 0);

  useEffect(() => {
    const requestedSymbols = symbolKey.split(",").filter(Boolean);
    if (requestedSymbols.length === 0) return;

    const controller = new AbortController();

    async function loadFeaturedNews() {
      const nextResults = await Promise.all(
        requestedSymbols.map(async (symbol): Promise<FeaturedResult> => {
          try {
            const response = await fetch(
              `/api/news?symbol=${encodeURIComponent(symbol)}`,
              { cache: "no-store", signal: controller.signal },
            );
            const payload: unknown = await response.json();
            if (!response.ok) throw new Error(readNewsError(payload));
            const result = parseNewsApiResponse(payload);
            return {
              symbol,
              article: result.articles[0] ?? null,
              error: null,
            };
          } catch (error) {
            return {
              symbol,
              article: null,
              error: error instanceof Error
                ? error.message
                : "News is temporarily unavailable.",
            };
          }
        }),
      );

      if (!controller.signal.aborted) {
        setResults(nextResults);
        setLoading(false);
      }
    }

    void loadFeaturedNews();
    return () => controller.abort();
  }, [symbolKey]);

  return (
    <section className="featured-news" aria-labelledby="featured-news-title">
      <div className="featured-news-heading">
        <div>
          <p className="eyebrow">MARKET BRIEF</p>
          <h2 id="featured-news-title">Featured news</h2>
        </div>
        <p>Recent coverage connected to your portfolio.</p>
      </div>

      {loading ? (
        <div className="featured-news-loading" role="status">
          Loading featured market news…
        </div>
      ) : results.length > 0 ? (
        <div className="featured-news-grid">
          {results.map(({ symbol, article, error }) => (
            <article className="featured-news-card" key={symbol}>
              <div className="featured-news-meta">
                <span className="featured-symbol">{symbol}</span>
                {article && (
                  <span>
                    {article.source} · {articleDate.format(new Date(article.publishedAt))}
                  </span>
                )}
              </div>
              {article ? (
                <>
                  <h3>
                    <a href={article.url} target="_blank" rel="noreferrer">
                      {article.title}
                    </a>
                  </h3>
                  {article.summary && <p>{article.summary}</p>}
                </>
              ) : (
                <>
                  <h3>No recent article available</h3>
                  <p>{error ?? `No cached story is currently available for ${symbol}.`}</p>
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="featured-news-loading">
          Add a holding to see featured portfolio news.
        </div>
      )}
    </section>
  );
}
