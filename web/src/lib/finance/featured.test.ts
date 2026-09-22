import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectRandomFeaturedNews,
  type FeaturedNewsItem,
} from "./featured";

function item(symbol: string, id: string): FeaturedNewsItem {
  return {
    symbol,
    article: {
      id,
      title: `Article ${id}`,
      source: "Example",
      url: `https://example.com/${id}`,
      publishedAt: "2026-09-22T00:00:00.000Z",
      fetchedAt: "2026-09-22T00:01:00.000Z",
      summary: null,
    },
  };
}

describe("selectRandomFeaturedNews", () => {
  const pool = [
    item("AAPL", "one"),
    item("META", "two"),
    item("TSLA", "three"),
    item("NVDA", "four"),
  ];

  it("returns two cached articles without duplicates", () => {
    const selected = selectRandomFeaturedNews(pool, 2, () => 0);
    assert.equal(selected.length, 2);
    assert.equal(new Set(selected.map(({ article }) => article.id)).size, 2);
  });

  it("avoids the current articles when enough alternatives exist", () => {
    const selected = selectRandomFeaturedNews(
      pool,
      2,
      () => 0,
      ["one", "two"],
    );
    assert.deepEqual(
      new Set(selected.map(({ article }) => article.id)),
      new Set(["three", "four"]),
    );
  });

  it("returns every available article when fewer than two are cached", () => {
    assert.deepEqual(
      selectRandomFeaturedNews([pool[0]], 2, () => 0),
      [pool[0]],
    );
  });

  it("deduplicates an article linked to multiple symbols", () => {
    const selected = selectRandomFeaturedNews(
      [pool[0], { ...pool[0], symbol: "META" }],
      2,
      () => 0,
    );
    assert.equal(selected.length, 1);
  });
});
