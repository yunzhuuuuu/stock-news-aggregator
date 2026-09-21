import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRecentPriceStatus } from "./refresh-server";

describe("isRecentPriceStatus", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");

  it("reuses a shared result checked less than twelve hours ago", () => {
    assert.equal(isRecentPriceStatus("2026-09-20T01:00:01.000Z", now), true);
  });

  it("refreshes missing, invalid, or twelve-hour-old status values", () => {
    assert.equal(isRecentPriceStatus(null, now), false);
    assert.equal(isRecentPriceStatus("not-a-date", now), false);
    assert.equal(isRecentPriceStatus("2026-09-20T00:00:00.000Z", now), false);
  });
});
