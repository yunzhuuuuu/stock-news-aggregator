import Decimal from "decimal.js";
import {
  DailyPriceProviderError,
  type DailyPriceInput,
  type DailyPriceProvider,
} from "./types";

const endpoint = "https://www.alphavantage.co/query";
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,5}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerError(payload: JsonObject, symbol: string) {
  const errorMessage = payload["Error Message"];
  if (typeof errorMessage === "string") {
    const code = errorMessage.includes("Invalid API call")
      ? "INVALID_SYMBOL"
      : "PROVIDER_ERROR";
    return new DailyPriceProviderError(
      `Alpha Vantage rejected ${symbol}: ${errorMessage}`,
      code,
    );
  }

  for (const key of ["Note", "Information"] as const) {
    const message = payload[key];
    if (typeof message === "string") {
      const code = /limit|request per second|rate/i.test(message)
        ? "RATE_LIMIT"
        : "PROVIDER_ERROR";
      return new DailyPriceProviderError(
        `Alpha Vantage rejected ${symbol}: ${message}`,
        code,
      );
    }
  }
  return null;
}

/**
 * Convert Alpha Vantage's numbered field names into the app's stable cache
 * shape. Invalid rows are ignored; a response with no usable rows is rejected.
 */
export function parseAlphaVantageDailyResponse(
  symbolValue: string,
  payload: unknown,
  fetchedAt = new Date().toISOString(),
): DailyPriceInput[] {
  const symbol = symbolValue.trim().toUpperCase();
  if (!symbolPattern.test(symbol)) throw new Error("Invalid stock symbol.");
  if (!isObject(payload)) throw new Error("The price provider returned invalid JSON.");

  const error = providerError(payload, symbol);
  if (error) throw error;

  const series = payload["Time Series (Daily)"];
  if (!isObject(series)) {
    throw new Error(`Alpha Vantage returned no daily prices for ${symbol}.`);
  }

  const rows = Object.entries(series).flatMap(([tradingDate, value]) => {
    if (!datePattern.test(tradingDate) || !isObject(value)) return [];
    const closeValue = value["4. close"];
    if (typeof closeValue !== "string") return [];

    try {
      const close = new Decimal(closeValue);
      if (!close.isFinite() || !close.greaterThan(0)) return [];
      return [{
        symbol,
        trading_date: tradingDate,
        close: close.toString(),
        currency: "USD",
        provider: "alpha_vantage",
        fetched_at: fetchedAt,
      }];
    } catch {
      return [];
    }
  });

  rows.sort((a, b) => b.trading_date.localeCompare(a.trading_date));
  if (rows.length === 0) {
    throw new Error(`Alpha Vantage returned no valid daily prices for ${symbol}.`);
  }
  return rows;
}

export function createAlphaVantageProvider(
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
): DailyPriceProvider {
  if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");

  return {
    async fetchDailyHistory(symbolValue) {
      const symbol = symbolValue.trim().toUpperCase();
      if (!symbolPattern.test(symbol)) throw new Error("Invalid stock symbol.");

      const url = new URL(endpoint);
      url.searchParams.set("function", "TIME_SERIES_DAILY");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("outputsize", "compact");
      url.searchParams.set("apikey", apiKey);

      // A stalled external request should not hold the server task forever.
      const response = await fetchImplementation(url, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Alpha Vantage request for ${symbol} failed with HTTP ${response.status}.`);
      }
      return parseAlphaVantageDailyResponse(symbol, await response.json());
    },
  };
}
