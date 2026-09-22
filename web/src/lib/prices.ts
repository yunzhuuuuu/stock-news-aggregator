import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyClose } from "@/lib/finance/calculations";

export type DailyPriceRow = {
  symbol: string;
  trading_date: string;
  close: string | number;
  currency: string;
  provider: string;
  fetched_at: string;
};

export type PriceHistories = Record<string, DailyClose[]>;

export type PriceRefreshStatus = "ok" | "invalid_symbol" | "temporary_error";

export type PriceRefreshStatusRow = {
  symbol: string;
  status: PriceRefreshStatus;
  message: string | null;
  checked_at: string;
};

export type PriceRefreshStatuses = Record<string, PriceRefreshStatusRow>;

/**
 * Fetch at most 100 rows per symbol. Alpha Vantage's compact daily response
 * contains roughly that many trading days, which supports the lightweight
 * recent-price chart without making a second request. Separate queries make
 * the per-symbol limit
 * explicit; a single global limit could let one symbol crowd out the others.
 */
export async function loadPriceHistories(
  supabase: SupabaseClient,
  symbols: string[],
): Promise<{ histories: PriceHistories; error: string | null }> {
  if (symbols.length === 0) return { histories: {}, error: null };

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const { data, error } = await supabase
        .from("daily_prices")
        .select("symbol,trading_date,close,currency,provider,fetched_at")
        .eq("symbol", symbol)
        .order("trading_date", { ascending: false })
        .limit(100);
      return { symbol, data: (data ?? []) as DailyPriceRow[], error };
    }),
  );

  const firstError = results.find((result) => result.error)?.error;
  const histories = Object.fromEntries(
    results.map(({ symbol, data }) => [
      symbol,
      data.map((row) => ({
        tradingDate: row.trading_date,
        close: row.close,
      })),
    ]),
  );

  return { histories, error: firstError?.message ?? null };
}

/** Status is shared like prices, but it never contains private position data. */
export async function loadPriceRefreshStatuses(
  supabase: SupabaseClient,
  symbols: string[],
): Promise<{ statuses: PriceRefreshStatuses; error: string | null }> {
  if (symbols.length === 0) return { statuses: {}, error: null };

  const { data, error } = await supabase
    .from("price_refresh_status")
    .select("symbol,status,message,checked_at")
    .in("symbol", symbols);
  const rows = (data ?? []) as PriceRefreshStatusRow[];

  return {
    statuses: Object.fromEntries(rows.map((row) => [row.symbol, row])),
    error: error?.message ?? null,
  };
}
