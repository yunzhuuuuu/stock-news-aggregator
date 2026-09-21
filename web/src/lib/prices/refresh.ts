import {
  DailyPriceProviderError,
  type DailyPriceInput,
  type DailyPriceProvider,
  type DailyPriceProviderErrorCode,
} from "@/lib/providers/types";

export type SymbolRefreshResult =
  | { symbol: string; status: "updated"; rows: number }
  | {
      symbol: string;
      status: "failed";
      code: DailyPriceProviderErrorCode;
      error: string;
    };

type RefreshDependencies = {
  provider: DailyPriceProvider;
  upsert: (rows: DailyPriceInput[]) => Promise<void>;
  waitBetweenSymbols?: () => Promise<void>;
};

/**
 * Refresh symbols sequentially. Alpha Vantage's development quota is small,
 * and sequential requests avoid an accidental burst. A failed symbol never
 * deletes or replaces the last successful cache rows.
 */
export async function refreshDailyPrices(
  symbols: string[],
  { provider, upsert, waitBetweenSymbols }: RefreshDependencies,
): Promise<SymbolRefreshResult[]> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort();
  const results: SymbolRefreshResult[] = [];

  for (const [index, symbol] of uniqueSymbols.entries()) {
    // Sequential promises can still complete within the same second. The
    // provider-specific route supplies a pause that respects its burst limit.
    if (index > 0 && waitBetweenSymbols) await waitBetweenSymbols();

    try {
      const rows = await provider.fetchDailyHistory(symbol);
      await upsert(rows);
      results.push({ symbol, status: "updated", rows: rows.length });
    } catch (error) {
      results.push({
        symbol,
        status: "failed",
        code: error instanceof DailyPriceProviderError
          ? error.code
          : "PROVIDER_ERROR",
        error: error instanceof Error ? error.message : "Unknown refresh error.",
      });
    }
  }

  return results;
}
