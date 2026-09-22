import type { DailyClose } from "./calculations";

export type ChartRange = "1W" | "1M" | "3M" | "MAX";

export type ChartPoint = {
  tradingDate: string;
  close: number;
};

const rangeDays: Record<ChartRange, number | null> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  MAX: null,
};

/**
 * Prepare database rows for drawing: reject invalid prices, sort oldest first,
 * and keep only the requested calendar window relative to the newest close.
 */
export function buildChartSeries(
  history: DailyClose[],
  range: ChartRange,
): ChartPoint[] {
  const points = history
    .map(({ tradingDate, close }) => ({ tradingDate, close: Number(close) }))
    .filter(
      ({ tradingDate, close }) =>
        /^\d{4}-\d{2}-\d{2}$/.test(tradingDate) &&
        Number.isFinite(close) &&
        close > 0,
    )
    .sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));

  const days = rangeDays[range];
  if (days === null || points.length === 0) return points;

  const latestDate = new Date(`${points.at(-1)!.tradingDate}T00:00:00Z`);
  latestDate.setUTCDate(latestDate.getUTCDate() - days);
  const cutoff = latestDate.toISOString().slice(0, 10);
  return points.filter((point) => point.tradingDate >= cutoff);
}

export function calculateChartChange(points: ChartPoint[]) {
  if (points.length < 2) return null;
  const first = points[0].close;
  const last = points.at(-1)!.close;
  return {
    amount: last - first,
    percent: ((last - first) / first) * 100,
  };
}

export function calculateLatestPriceChange(history: DailyClose[]) {
  return calculateChartChange(buildChartSeries(history, "MAX").slice(-2));
}
