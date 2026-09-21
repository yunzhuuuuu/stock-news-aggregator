/**
 * Stage A uses local example data so the interface can be built without a
 * database or a stock-data API. These values are invented for layout testing.
 *
 * In Stage B/C, server-side database/API functions will replace these arrays.
 * Keeping the data shape here makes that change easier to follow.
 */
export type DemoHolding = {
  symbol: string;
  company: string;
  quantity: number;
  averageCost: number;
  // null means that we have no sample closing price for this holding.
  close: number | null;
  priceDate: string | null;
};

export type DemoArticle = {
  id: string;
  symbol: string;
  title: string;
  summary: string;
};

export const initialHoldings: DemoHolding[] = [
  {
    symbol: "AAPL",
    company: "Apple Inc.",
    quantity: 2.5,
    averageCost: 100,
    close: 110,
    priceDate: "Sample date: Sep 1, 2026",
  },
  {
    symbol: "MSFT",
    company: "Microsoft Corp.",
    quantity: 1,
    averageCost: 280,
    close: 295,
    priceDate: "Sample date: Sep 1, 2026",
  },
  {
    symbol: "NVDA",
    company: "NVIDIA Corp.",
    quantity: 3,
    averageCost: 75,
    close: 82,
    priceDate: "Sample date: Sep 1, 2026",
  },
];

/**
 * These are example headlines written for the prototype. They are not fetched
 * news stories and intentionally have no external article links.
 */
export const demoArticles: DemoArticle[] = [
  {
    id: "aapl-example",
    symbol: "AAPL",
    title: "Example headline: a company announces a new product",
    summary: "This placeholder shows where a real news summary could appear.",
  },
  {
    id: "msft-example",
    symbol: "MSFT",
    title: "Example headline: a quarterly report is published",
    summary: "A future provider will supply a source, publication time, and link.",
  },
  {
    id: "nvda-example",
    symbol: "NVDA",
    title: "Example headline: industry demand changes",
    summary: "This is sample text only. No live news API is connected.",
  },
];
