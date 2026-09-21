import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAlphaVantageDailyResponse } from "./alpha-vantage";
import { DailyPriceProviderError } from "./types";

describe("parseAlphaVantageDailyResponse", () => {
  it("normalizes valid closes and sorts the newest date first", () => {
    const result = parseAlphaVantageDailyResponse("aapl", {
      "Time Series (Daily)": {
        "2026-09-18": { "4. close": "231.4500" },
        "2026-09-19": { "4. close": "233.1000" },
      },
    }, "2026-09-20T12:00:00.000Z");

    assert.deepEqual(result, [
      {
        symbol: "AAPL",
        trading_date: "2026-09-19",
        close: "233.1",
        currency: "USD",
        provider: "alpha_vantage",
        fetched_at: "2026-09-20T12:00:00.000Z",
      },
      {
        symbol: "AAPL",
        trading_date: "2026-09-18",
        close: "231.45",
        currency: "USD",
        provider: "alpha_vantage",
        fetched_at: "2026-09-20T12:00:00.000Z",
      },
    ]);
  });

  it("ignores malformed rows while keeping valid provider data", () => {
    const result = parseAlphaVantageDailyResponse("MSFT", {
      "Time Series (Daily)": {
        "not-a-date": { "4. close": "100" },
        "2026-09-19": { "4. close": "-4" },
        "2026-09-18": { "4. close": "420.25" },
      },
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].close, "420.25");
  });

  it("surfaces rate-limit messages instead of treating them as prices", () => {
    assert.throws(
      () => parseAlphaVantageDailyResponse("AAPL", { Note: "Daily limit reached." }),
      (error) => error instanceof DailyPriceProviderError && error.code === "RATE_LIMIT",
    );
  });

  it("classifies an explicit invalid API call as an invalid symbol", () => {
    assert.throws(
      () => parseAlphaVantageDailyResponse("BBPL", {
          "Error Message": "Invalid API call. Please retry or visit the documentation.",
        }),
      (error) => error instanceof DailyPriceProviderError && error.code === "INVALID_SYMBOL",
    );
  });

  it("rejects a response without any usable daily closes", () => {
    assert.throws(
      () => parseAlphaVantageDailyResponse("AAPL", { "Time Series (Daily)": {} }),
      /no valid daily prices/,
    );
  });
});
