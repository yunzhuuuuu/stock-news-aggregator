import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DailyPriceInput } from "@/lib/providers/types";
import { DailyPriceProviderError } from "@/lib/providers/types";
import { refreshDailyPrices } from "./refresh";

const row = (symbol: string): DailyPriceInput => ({
  symbol,
  trading_date: "2026-09-19",
  close: "100",
  currency: "USD",
  provider: "test",
  fetched_at: "2026-09-20T12:00:00.000Z",
});

describe("refreshDailyPrices", () => {
  it("deduplicates symbols and writes each successful history once", async () => {
    const requested: string[] = [];
    const written: string[] = [];
    const results = await refreshDailyPrices(["AAPL", "aapl", "MSFT"], {
      provider: {
        async fetchDailyHistory(symbol) {
          requested.push(symbol);
          return [row(symbol)];
        },
      },
      async upsert(rows) {
        written.push(rows[0].symbol);
      },
    });

    assert.deepEqual(requested, ["AAPL", "MSFT"]);
    assert.deepEqual(written, ["AAPL", "MSFT"]);
    assert.equal(results.every((result) => result.status === "updated"), true);
  });

  it("continues after one symbol fails and never writes failed data", async () => {
    const written: string[] = [];
    const results = await refreshDailyPrices(["AAPL", "FAIL", "MSFT"], {
      provider: {
        async fetchDailyHistory(symbol) {
          if (symbol === "FAIL") throw new Error("Provider unavailable");
          return [row(symbol)];
        },
      },
      async upsert(rows) {
        written.push(rows[0].symbol);
      },
    });

    assert.deepEqual(written, ["AAPL", "MSFT"]);
    assert.deepEqual(results[1], {
      symbol: "FAIL",
      status: "failed",
      code: "PROVIDER_ERROR",
      error: "Provider unavailable",
    });
  });

  it("preserves an invalid-symbol classification from the provider", async () => {
    const [result] = await refreshDailyPrices(["BBPL"], {
      provider: {
        async fetchDailyHistory() {
          throw new DailyPriceProviderError("Invalid ticker", "INVALID_SYMBOL");
        },
      },
      async upsert() {},
    });

    assert.deepEqual(result, {
      symbol: "BBPL",
      status: "failed",
      code: "INVALID_SYMBOL",
      error: "Invalid ticker",
    });
  });

  it("waits between different symbols when the caller supplies a limiter", async () => {
    let waits = 0;
    await refreshDailyPrices(["AAPL", "MSFT", "TSLA"], {
      provider: { async fetchDailyHistory(symbol) { return [row(symbol)]; } },
      async upsert() {},
      async waitBetweenSymbols() { waits += 1; },
    });

    assert.equal(waits, 2);
  });
});
