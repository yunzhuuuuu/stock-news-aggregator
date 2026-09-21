import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNewsApiResponse, readNewsError } from "./client";

const article = {
  id: "article-1",
  title: "Apple headline",
  source: "Example News",
  url: "https://example.com/apple",
  publishedAt: "2026-09-20T15:00:00.000Z",
  fetchedAt: "2026-09-20T15:05:00.000Z",
  summary: "A short summary.",
};

describe("parseNewsApiResponse", () => {
  it("accepts a valid cached-news response", () => {
    const result = parseNewsApiResponse({
      articles: [article],
      status: "fresh",
      message: null,
    });
    assert.equal(result.articles[0].title, "Apple headline");
    assert.equal(result.status, "fresh");
  });

  it("rejects unsafe article links", () => {
    assert.throws(
      () => parseNewsApiResponse({
        articles: [{ ...article, url: "http://example.com/apple" }],
        status: "fresh",
        message: null,
      }),
      /unsafe article link/,
    );
  });

  it("rejects unknown cache states and malformed dates", () => {
    assert.throws(
      () => parseNewsApiResponse({ articles: [], status: "unknown", message: null }),
      /invalid status/,
    );
    assert.throws(
      () => parseNewsApiResponse({
        articles: [{ ...article, publishedAt: "not-a-date" }],
        status: "fresh",
        message: null,
      }),
      /invalid article date/,
    );
  });
});

describe("readNewsError", () => {
  it("uses a safe API error or a generic fallback", () => {
    assert.equal(readNewsError({ error: "Sign in again." }), "Sign in again.");
    assert.equal(readNewsError("bad response"), "News is temporarily unavailable.");
  });
});
