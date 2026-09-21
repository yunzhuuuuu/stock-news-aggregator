import Decimal from "decimal.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePortfolioSummary,
  calculatePositionMetrics,
  classifySignal,
  type DailyClose,
} from "./calculations";

function history(latestFive: number, olderFifteen: number): DailyClose[] {
  return Array.from({ length: 20 }, (_, index) => ({
    tradingDate: `2026-09-${String(20 - index).padStart(2, "0")}`,
    close: index < 5 ? latestFive : olderFifteen,
  }));
}

describe("calculatePositionMetrics", () => {
  it("calculates fractional shares and unrealized profit precisely", () => {
    const result = calculatePositionMetrics(2.5, 100, [
      { tradingDate: "2026-09-19", close: 110 },
    ]);

    assert.equal(result.marketValue, "275");
    assert.equal(result.costBasis, "250");
    assert.equal(result.unrealizedProfitLoss, "25");
    assert.equal(result.returnPercent, "10");
  });

  it("does not invent a return percentage when average cost is zero", () => {
    const result = calculatePositionMetrics(2, 0, [
      { tradingDate: "2026-09-19", close: 50 },
    ]);

    assert.equal(result.marketValue, "100");
    assert.equal(result.unrealizedProfitLoss, "100");
    assert.equal(result.returnPercent, null);
  });

  it("reports missing price data instead of guessing", () => {
    const result = calculatePositionMetrics(1, 100, []);

    assert.equal(result.latestClose, null);
    assert.equal(result.marketValue, null);
    assert.equal(result.signal, "INSUFFICIENT_DATA");
  });

  it("uses the latest available trading date even when it is not today", () => {
    const result = calculatePositionMetrics(1, 100, [
      { tradingDate: "2026-09-18", close: 101 },
      { tradingDate: "2026-09-17", close: 99 },
    ]);

    assert.equal(result.priceDate, "2026-09-18");
    assert.equal(result.latestClose, "101");
  });

  it("requires twenty closing prices before assigning a signal", () => {
    const result = calculatePositionMetrics(1, 100, history(110, 100).slice(0, 19));
    assert.equal(result.signal, "INSUFFICIENT_DATA");
    assert.equal(result.sma20, null);
  });

  it("assigns BUY when SMA5 is more than two percent above SMA20", () => {
    assert.equal(calculatePositionMetrics(1, 100, history(110, 100)).signal, "BUY");
  });

  it("assigns SELL when SMA5 is more than two percent below SMA20", () => {
    assert.equal(calculatePositionMetrics(1, 100, history(90, 100)).signal, "SELL");
  });

  it("assigns HOLD when the averages remain within the threshold", () => {
    assert.equal(calculatePositionMetrics(1, 100, history(101, 100)).signal, "HOLD");
  });
});

describe("classifySignal", () => {
  it("keeps the exact positive and negative two-percent boundaries as HOLD", () => {
    assert.equal(classifySignal(new Decimal(102), new Decimal(100)), "HOLD");
    assert.equal(classifySignal(new Decimal(98), new Decimal(100)), "HOLD");
    assert.equal(classifySignal(new Decimal("102.0001"), new Decimal(100)), "BUY");
    assert.equal(classifySignal(new Decimal("97.9999"), new Decimal(100)), "SELL");
  });
});

describe("calculatePortfolioSummary", () => {
  it("totals only positions with available prices", () => {
    const priced = calculatePositionMetrics(2, 10, [
      { tradingDate: "2026-09-19", close: 15 },
    ]);
    const missing = calculatePositionMetrics(1, 20, []);
    const result = calculatePortfolioSummary([priced, missing]);

    assert.equal(result.totalMarketValue, "30");
    assert.equal(result.totalUnrealizedProfitLoss, "10");
    assert.equal(result.pricedPositions, 1);
    assert.equal(result.totalPositions, 2);
  });
});
