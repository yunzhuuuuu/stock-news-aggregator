type PositionForFeaturedNews = {
  symbol: string;
  metrics: {
    unrealizedProfitLoss: string | null;
  };
};

/**
 * Choose the highest and lowest unrealized P/L positions. The selection rule
 * stays in application logic and is not described in the user interface.
 */
export function selectFeaturedSymbols(
  positions: PositionForFeaturedNews[],
): string[] {
  const priced = positions
    .map((position) => ({
      symbol: position.symbol,
      profitLoss: Number(position.metrics.unrealizedProfitLoss),
      available: position.metrics.unrealizedProfitLoss !== null,
    }))
    .filter((position) => position.available && Number.isFinite(position.profitLoss))
    .sort((a, b) => b.profitLoss - a.profitLoss);

  if (priced.length >= 2) {
    return [priced[0].symbol, priced.at(-1)!.symbol];
  }

  const fallback = [
    ...priced.map((position) => position.symbol),
    ...positions.map((position) => position.symbol),
  ];
  return [...new Set(fallback)].slice(0, 2);
}
