export const defaultHoldings = [
  { symbol: "AAPL", quantity: 15, averageCost: 200 },
  { symbol: "META", quantity: 15, averageCost: 700 },
  { symbol: "TSLA", quantity: 15, averageCost: 400 },
] as const;

export const defaultHoldingSymbols: ReadonlySet<string> = new Set(
  defaultHoldings.map((holding) => holding.symbol),
);
