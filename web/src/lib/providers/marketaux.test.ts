import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMarketauxProvider, parseMarketauxResponse } from "./marketaux";
import { NewsProviderError } from "./news-types";

const validArticle = {
  uuid: "article-1",
  title: "Nvidia announces a product update",
  snippet: "A short provider-supplied summary.",
  url: "https://example.com/story?utm_source=test#section",
  published_at: "2026-09-20T12:00:00Z",
  source: "Example News",
  entities: [{ symbol: "NVDA" }],
};

describe("parseMarketauxResponse", () => {
  it("normalizes a valid article and removes tracking URL fields", () => {
    const [article] = parseMarketauxResponse(
      ["nvda"],
      { data: [validArticle] },
      "2026-09-20T13:00:00.000Z",
    );

    assert.deepEqual(article, {
      provider: "marketaux",
      providerArticleId: "article-1",
      title: "Nvidia announces a product update",
      source: "Example News",
      url: "https://example.com/story",
      publishedAt: "2026-09-20T12:00:00.000Z",
      fetchedAt: "2026-09-20T13:00:00.000Z",
      summary: "A short provider-supplied summary.",
      symbols: ["NVDA"],
    });
  });

  it("filters unrelated, insecure, malformed, and duplicate articles", () => {
    const result = parseMarketauxResponse(["NVDA"], {
      data: [
        validArticle,
        { ...validArticle, uuid: "duplicate-url" },
        { ...validArticle, uuid: "insecure", url: "http://example.com/story-2" },
        { ...validArticle, uuid: "unrelated", url: "https://example.com/other", entities: [{ symbol: "AAPL" }] },
        { ...validArticle, uuid: "bad-date", url: "https://example.com/bad", published_at: "not-a-date" },
      ],
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].providerArticleId, "article-1");
  });

  it("accepts a valid empty result instead of inventing headlines", () => {
    assert.deepEqual(parseMarketauxResponse(["AAPL"], { data: [] }), []);
  });

  it("surfaces a provider error response", () => {
    assert.throws(
      () => parseMarketauxResponse(["AAPL"], { error: { message: "Bad token" } }),
      (error) => error instanceof NewsProviderError && /Bad token/.test(error.message),
    );
  });

  it("limits cached summaries to 500 characters", () => {
    const [article] = parseMarketauxResponse(["NVDA"], {
      data: [{ ...validArticle, snippet: "x".repeat(700) }],
    });
    assert.equal(article.summary?.length, 500);
  });
});

describe("createMarketauxProvider", () => {
  it("uses server credentials and the expected low-volume query", async () => {
    let requestedUrl = "";
    const fakeFetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ data: [validArticle] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const provider = createMarketauxProvider("test-token", fakeFetch);
    const result = await provider.fetchArticles(["NVDA", "NVDA"]);
    const parsedUrl = new URL(requestedUrl);

    assert.equal(result.length, 1);
    assert.equal(parsedUrl.searchParams.get("symbols"), "NVDA");
    assert.equal(parsedUrl.searchParams.get("limit"), "3");
    assert.equal(parsedUrl.searchParams.get("api_token"), "test-token");
  });

  it("classifies HTTP 429 as a rate-limit failure", async () => {
    const fakeFetch = (async () => new Response("", { status: 429 })) as typeof fetch;
    const provider = createMarketauxProvider("test-token", fakeFetch);

    await assert.rejects(
      () => provider.fetchArticles(["AAPL"]),
      (error) => error instanceof NewsProviderError && error.code === "RATE_LIMIT",
    );
  });
});
