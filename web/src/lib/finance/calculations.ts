import Decimal from "decimal.js";

// Financial values are calculated as decimals instead of binary JavaScript
// numbers. This avoids familiar errors such as 0.1 + 0.2 becoming
// 0.30000000000000004. Conversion to a display number happens only in the UI.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DailyClose = {
  tradingDate: string;
  close: string | number;
};

export type TradingSignal = "BUY" | "HOLD" | "SELL" | "INSUFFICIENT_DATA";

export type PositionMetrics = {
  latestClose: string | null;
  priceDate: string | null;
  marketValue: string | null;
  costBasis: string;
  unrealizedProfitLoss: string | null;
  returnPercent: string | null;
  sma5: string | null;
  sma20: string | null;
  signalDifferencePercent: string | null;
  signal: TradingSignal;
  historyCount: number;
};

export type PortfolioSummary = {
  totalMarketValue: string;
  totalUnrealizedProfitLoss: string;
  pricedPositions: number;
  totalPositions: number;
};

function average(values: Decimal[]) {
  return values
    .reduce((sum, value) => sum.plus(value), new Decimal(0))
    .div(values.length);
}

/** Thresholds are strict: exactly +2% or -2% remains HOLD. */
export function classifySignal(sma5: Decimal, sma20: Decimal): TradingSignal {
  if (sma20.isZero()) return "INSUFFICIENT_DATA";

  const difference = sma5.div(sma20).minus(1);
  if (difference.greaterThan(0.02)) return "BUY";
  if (difference.lessThan(-0.02)) return "SELL";
  return "HOLD";
}

/**
 * Calculate one holding from its latest available closing-price history.
 * Dates are sorted here so callers cannot accidentally treat an older row as
 * the newest price. Weekends and holidays naturally keep the last trading day.
 */
export function calculatePositionMetrics(
  quantityValue: string | number,
  averageCostValue: string | number,
  history: DailyClose[],
): PositionMetrics {
  const quantity = new Decimal(quantityValue);
  const averageCost = new Decimal(averageCostValue);
  const costBasis = quantity.times(averageCost);
  const sortedHistory = [...history].sort((a, b) =>
    b.tradingDate.localeCompare(a.tradingDate),
  );
  const validHistory = sortedHistory.filter(({ close }) =>
    new Decimal(close).greaterThan(0),
  );

  if (validHistory.length === 0) {
    return {
      latestClose: null,
      priceDate: null,
      marketValue: null,
      costBasis: costBasis.toString(),
      unrealizedProfitLoss: null,
      returnPercent: null,
      sma5: null,
      sma20: null,
      signalDifferencePercent: null,
      signal: "INSUFFICIENT_DATA",
      historyCount: 0,
    };
  }

  const latest = validHistory[0];
  const latestClose = new Decimal(latest.close);
  const marketValue = quantity.times(latestClose);
  const profitLoss = marketValue.minus(costBasis);
  const returnPercent = averageCost.isZero()
    ? null
    : latestClose.div(averageCost).minus(1).times(100);

  let sma5: Decimal | null = null;
  let sma20: Decimal | null = null;
  let differencePercent: Decimal | null = null;
  let signal: TradingSignal = "INSUFFICIENT_DATA";

  if (validHistory.length >= 5) {
    sma5 = average(validHistory.slice(0, 5).map(({ close }) => new Decimal(close)));
  }
  if (validHistory.length >= 20 && sma5) {
    sma20 = average(validHistory.slice(0, 20).map(({ close }) => new Decimal(close)));
    differencePercent = sma20.isZero()
      ? null
      : sma5.div(sma20).minus(1).times(100);
    signal = classifySignal(sma5, sma20);
  }

  return {
    latestClose: latestClose.toString(),
    priceDate: latest.tradingDate,
    marketValue: marketValue.toString(),
    costBasis: costBasis.toString(),
    unrealizedProfitLoss: profitLoss.toString(),
    returnPercent: returnPercent?.toString() ?? null,
    sma5: sma5?.toString() ?? null,
    sma20: sma20?.toString() ?? null,
    signalDifferencePercent: differencePercent?.toString() ?? null,
    signal,
    historyCount: validHistory.length,
  };
}

export function calculatePortfolioSummary(
  metrics: PositionMetrics[],
): PortfolioSummary {
  const priced = metrics.filter(
    (item): item is PositionMetrics & {
      marketValue: string;
      unrealizedProfitLoss: string;
    } => item.marketValue !== null && item.unrealizedProfitLoss !== null,
  );

  return {
    totalMarketValue: priced
      .reduce((sum, item) => sum.plus(item.marketValue), new Decimal(0))
      .toString(),
    totalUnrealizedProfitLoss: priced
      .reduce(
        (sum, item) => sum.plus(item.unrealizedProfitLoss),
        new Decimal(0),
      )
      .toString(),
    pricedPositions: priced.length,
    totalPositions: metrics.length,
  };
}
