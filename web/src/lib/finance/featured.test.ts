import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectFeaturedSymbols } from "./featured";

function position(symbol: string, profitLoss: string | null) {
  return { symbol, metrics: { unrealizedProfitLoss: profitLoss } };
}

describe("selectFeaturedSymbols", () => {
  it("selects the largest gain and largest loss", () => {
    assert.deepEqual(
      selectFeaturedSymbols([
        position("AAPL", "50"),
        position("META", "-200"),
        position("TSLA", "600"),
      ]),
      ["TSLA", "META"],
    );
  });

  it("falls back to distinct holdings when prices are unavailable", () => {
    assert.deepEqual(
      selectFeaturedSymbols([
        position("AAPL", null),
        position("META", null),
        position("TSLA", null),
      ]),
      ["AAPL", "META"],
    );
  });

  it("never duplicates the only available symbol", () => {
    assert.deepEqual(
      selectFeaturedSymbols([position("AAPL", "10")]),
      ["AAPL"],
    );
  });
});
