import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChartSeries,
  calculateChartChange,
  calculateLatestPriceChange,
} from "./chart";

describe("price chart helpers", () => {
  const history = [
    { tradingDate: "2026-09-18", close: "110" },
    { tradingDate: "2026-06-01", close: "90" },
    { tradingDate: "2026-09-01", close: "100" },
    { tradingDate: "invalid", close: "105" },
    { tradingDate: "2026-09-10", close: "0" },
  ];

  it("sorts valid closes oldest first", () => {
    assert.deepEqual(buildChartSeries(history, "MAX"), [
      { tradingDate: "2026-06-01", close: 90 },
      { tradingDate: "2026-09-01", close: 100 },
      { tradingDate: "2026-09-18", close: 110 },
    ]);
  });

  it("filters relative to the newest close for a selected range", () => {
    assert.deepEqual(buildChartSeries(history, "1M"), [
      { tradingDate: "2026-09-01", close: 100 },
      { tradingDate: "2026-09-18", close: 110 },
    ]);
  });

  it("calculates the selected period change", () => {
    assert.deepEqual(
      calculateChartChange([
        { tradingDate: "2026-09-01", close: 100 },
        { tradingDate: "2026-09-18", close: 110 },
      ]),
      { amount: 10, percent: 10 },
    );
  });

  it("does not claim a trend from one point", () => {
    assert.equal(
      calculateChartChange([{ tradingDate: "2026-09-18", close: 110 }]),
      null,
    );
  });

  it("calculates the change between the latest two trading days", () => {
    assert.deepEqual(calculateLatestPriceChange(history), {
      amount: 10,
      percent: 10,
    });
  });
});
