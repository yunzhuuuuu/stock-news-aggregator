"use client";

import type { FeaturedNewsItem } from "@/lib/finance/featured";

const articleDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export default function FeaturedNews({
  items,
}: {
  items: FeaturedNewsItem[];
}) {
  return (
    <section className="featured-news" aria-labelledby="featured-news-title">
      <div className="featured-news-heading">
        <div>
          <p className="eyebrow">MARKET BRIEF</p>
          <h2 id="featured-news-title">Featured news</h2>
        </div>
        <p>Recent coverage connected to your portfolio.</p>
      </div>

      {items.length > 0 ? (
        <div className="featured-news-grid">
          {items.map(({ symbol, article }) => (
            <article
              className="featured-news-card"
              key={article.id}
            >
              <div className="featured-news-meta">
                <span className="featured-symbol">{symbol}</span>
                <span>
                  {article.source} · {articleDate.format(new Date(article.publishedAt))}
                </span>
              </div>
              <h3>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                </a>
              </h3>
              {article.summary && <p>{article.summary}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="featured-news-loading">
          No cached market news is available right now.
        </div>
      )}
    </section>
  );
}
