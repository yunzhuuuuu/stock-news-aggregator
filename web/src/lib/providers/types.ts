/** A provider-neutral daily close ready to be written to the shared cache. */
export type DailyPriceInput = {
  symbol: string;
  trading_date: string;
  close: string;
  currency: string;
  provider: string;
  fetched_at: string;
};

/**
 * The rest of the app depends on this small interface instead of a vendor's
 * response format. A future provider only needs to implement this function.
 */
export type DailyPriceProvider = {
  fetchDailyHistory(symbol: string): Promise<DailyPriceInput[]>;
};

export type DailyPriceProviderErrorCode =
  | "INVALID_SYMBOL"
  | "RATE_LIMIT"
  | "PROVIDER_ERROR";

/** A typed error lets the UI distinguish user-fixable symbols from outages. */
export class DailyPriceProviderError extends Error {
  constructor(
    message: string,
    public readonly code: DailyPriceProviderErrorCode,
  ) {
    super(message);
    this.name = "DailyPriceProviderError";
  }
}
