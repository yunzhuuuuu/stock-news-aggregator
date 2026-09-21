import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewsArticleInput } from "@/lib/providers/news-types";
import { refreshNewsCache } from "./refresh";
import type { CachedNewsArticle, NewsRefreshClaim } from "./types";

const cached: CachedNewsArticle = {
  id: "cached-1",
  title: "Cached headline",
  source: "Example",
  url: "https://example.com/cached",
  publishedAt: "2026-09-20T12:00:00.000Z",
  fetchedAt: "2026-09-20T12:05:00.000Z",
  summary: null,
};

const incoming: NewsArticleInput = {
  provider: "test",
  providerArticleId: "new-1",
  title: "New headline",
  source: "Example",
  url: "https://example.com/new",
  publishedAt: "2026-09-20T13:00:00.000Z",
  fetchedAt: "2026-09-20T13:01:00.000Z",
  summary: null,
  symbols: ["AAPL"],
};

function dependencies(claim: NewsRefreshClaim) {
  let fetches = 0;
  let persisted = 0;
  const completions: boolean[] = [];
  return {
    counters: { get fetches() { return fetches; }, get persisted() { return persisted; }, completions },
    values: {
      async loadCached() { return [cached]; },
      async claim() { return claim; },
      async fetchArticles() { fetches += 1; return [incoming]; },
      async persist(articles: NewsArticleInput[]) { persisted += articles.length; },
      async complete(success: boolean) { completions.push(success); },
    },
  };
}

describe("refreshNewsCache", () => {
  it("returns a fresh cache without calling the provider", async () => {
    const setup = dependencies({ claimed: false, reason: "fresh", requestCount: 4 });
    const result = await refreshNewsCache(setup.values);

    assert.equal(result.status, "fresh");
    assert.equal(setup.counters.fetches, 0);
    assert.equal(result.requestCount, 4);
  });

  it("fetches, persists, and completes a claimed refresh", async () => {
    const setup = dependencies({ claimed: true, reason: "claimed", requestCount: 5 });
    const result = await refreshNewsCache(setup.values);

    assert.equal(result.status, "refreshed");
    assert.equal(setup.counters.fetches, 1);
    assert.equal(setup.counters.persisted, 1);
    assert.deepEqual(setup.counters.completions, [true]);
  });

  it("serves stale cache and releases the lease after provider failure", async () => {
    const setup = dependencies({ claimed: true, reason: "claimed", requestCount: 6 });
    setup.values.fetchArticles = async () => { throw new Error("Provider unavailable"); };
    const result = await refreshNewsCache(setup.values);

    assert.equal(result.status, "stale_error");
    assert.deepEqual(result.articles, [cached]);
    assert.deepEqual(setup.counters.completions, [false]);
  });

  it("returns cached data while another request owns the lease", async () => {
    const setup = dependencies({ claimed: false, reason: "leased", requestCount: 7 });
    const result = await refreshNewsCache(setup.values);
    assert.equal(result.status, "updating");
    assert.equal(setup.counters.fetches, 0);
  });

  it("returns cached data when the daily internal budget is exhausted", async () => {
    const setup = dependencies({ claimed: false, reason: "budget_exhausted", requestCount: 90 });
    const result = await refreshNewsCache(setup.values);
    assert.equal(result.status, "budget_exhausted");
    assert.equal(result.requestCount, 90);
    assert.equal(setup.counters.fetches, 0);
  });
});
