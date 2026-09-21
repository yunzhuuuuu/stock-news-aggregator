"use client";

import { useActionState, useEffect, useState } from "react";
import { logout } from "@/app/auth/actions";
import {
  addPosition,
  deletePosition,
  refreshAllPrices,
  updatePosition,
} from "@/app/positions/actions";
import {
  emptyActionState,
  type ActionState,
  type Position,
  type PositionView,
} from "@/lib/positions";
import type { PortfolioSummary } from "@/lib/finance/calculations";
import {
  parseNewsApiResponse,
  readNewsError,
  type NewsApiResponse,
} from "@/lib/news/client";

type DetailTab = "overview" | "signal" | "news";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(Number(quantity));
}

function formatMoney(value: string | null) {
  return value === null ? "Not available" : money.format(Number(value));
}

function formatSignedMoney(value: string | null) {
  if (value === null) return "Not available";
  const amount = Number(value);
  return `${amount > 0 ? "+" : ""}${money.format(amount)}`;
}

function formatPercent(value: string | null) {
  if (value === null) return null;
  const percent = Number(value);
  return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

function valueTone(value: string | null) {
  if (value === null || Number(value) === 0) return "value-neutral";
  return Number(value) > 0 ? "value-positive" : "value-negative";
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  return dateTime.format(new Date(value));
}

function NewsPanel({ symbol, enabled }: { symbol: string; enabled: boolean }) {
  const [result, setResult] = useState<NewsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let inFlight = false;

    async function loadNews() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(readNewsError(payload));
        if (!controller.signal.aborted) {
          setResult(parseNewsApiResponse(payload));
          setError(null);
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "News is temporarily unavailable.");
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadNews();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNews();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, [enabled, symbol]);

  if (!enabled) {
    return (
      <div className="empty-news">
        News is unavailable because this holding does not have a valid stock symbol.
      </div>
    );
  }
  if (loading) {
    return <div className="news-loading" role="status">Checking cached news for {symbol}…</div>;
  }
  if (error) {
    return (
      <div className="news-error" role="alert">
        <strong>Could not load news.</strong>
        <p>{error}</p>
      </div>
    );
  }
  if (!result) return null;

  const statusText = result.status === "refreshed"
    ? "News cache updated just now."
    : result.status === "fresh"
      ? "Showing the current shared cache."
      : result.message;

  return (
    <div>
      <div className="news-intro">
        <h3>Latest news for {symbol}</h3>
        <p>
          Headlines come from Marketaux and link to the original publisher.
          News may be cached for up to five minutes.
        </p>
      </div>
      {statusText && (
        <div
          className={
            result.status === "stale_error" || result.status === "budget_exhausted"
              ? "news-status news-status-warning"
              : "news-status"
          }
          role="status"
        >
          {statusText}
        </div>
      )}
      {result.articles.length === 0 ? (
        <div className="empty-news">
          No recent articles were returned for {symbol}. The app does not invent headlines.
        </div>
      ) : (
        <div className="news-list">
          {result.articles.map((article) => (
            <article className="news-item" key={article.id}>
              <div className="news-meta">
                <strong>{article.source}</strong>
                <span>Published {formatDateTime(article.publishedAt)}</span>
              </div>
              <h4>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                </a>
              </h4>
              {article.summary && <p>{article.summary}</p>}
              <p className="news-fetched">Cached {formatDateTime(article.fetchedAt)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
/** The same fields are reused for both adding and editing a position. */
function PositionFields({ position }: { position?: Position }) {
  return (
    <>
      <label htmlFor={position ? "edit-symbol" : "symbol"}>Stock symbol</label>
      <input
        id={position ? "edit-symbol" : "symbol"}
        name="symbol"
        defaultValue={position?.symbol}
        placeholder="e.g. AAPL"
        maxLength={6}
        autoCapitalize="characters"
        required
      />
      <div className="form-row">
        <div>
          <label htmlFor={position ? "edit-quantity" : "quantity"}>Shares</label>
          <input
            id={position ? "edit-quantity" : "quantity"}
            name="quantity"
            type="number"
            min="0.000001"
            step="0.000001"
            defaultValue={position?.quantity}
            placeholder="2.5"
            required
          />
        </div>
        <div>
          <label htmlFor={position ? "edit-cost" : "averageCost"}>Avg. cost ($)</label>
          <input
            id={position ? "edit-cost" : "averageCost"}
            name="averageCost"
            type="number"
            min="0"
            step="0.0001"
            defaultValue={position?.average_cost}
            placeholder="100"
            required
          />
        </div>
      </div>
    </>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={state.error ? "form-feedback form-feedback-error" : "form-feedback"}
      role={state.error ? "alert" : "status"}
    >
      {state.error ?? state.message}
    </p>
  );
}

function EditPositionForm({
  position,
  onCancel,
}: {
  position: Position;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    updatePosition,
    emptyActionState,
  );

  return (
    <form className="edit-form" action={action}>
      <input type="hidden" name="id" value={position.id} />
      <PositionFields position={position} />
      <Feedback state={state} />
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button className="button button-light" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeletePositionForm({ position }: { position: Position }) {
  const [state, action, pending] = useActionState(
    deletePosition,
    emptyActionState,
  );

  return (
    <form action={action} className="delete-form">
      <input type="hidden" name="id" value={position.id} />
      <button className="button button-danger" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function SignalPanel({ position }: { position: PositionView }) {
  const invalidSymbol = position.priceStatus === "invalid_symbol";
  const insufficientData = position.metrics.signal === "INSUFFICIENT_DATA";
  const signalLabel = invalidSymbol
    ? "UNAVAILABLE"
    : insufficientData
      ? "PENDING"
      : position.metrics.signal;
  const signalClass = invalidSymbol || insufficientData
    ? "signal-neutral"
    : position.metrics.signal === "BUY"
      ? "signal-buy"
      : position.metrics.signal === "SELL"
        ? "signal-sell"
        : "signal-hold";

  return (
    <div className="signal-panel">
      <div className="signal-summary">
        <div>
          <span className="signal-label">Current signal</span>
          <strong className={`signal-badge ${signalClass}`}>{signalLabel}</strong>
        </div>
        <p>
          {invalidSymbol
            ? "Correct the stock symbol before calculating a signal."
            : insufficientData
              ? `${position.metrics.historyCount} of 20 daily closes are available. The app waits for enough data instead of guessing.`
              : "A comparison of short-term and longer-term price momentum."}
        </p>
      </div>

      <dl className="signal-metrics">
        <div>
          <dt>5-day average</dt>
          <dd>{formatMoney(position.metrics.sma5)}</dd>
          <small>SMA5</small>
        </div>
        <div>
          <dt>20-day average</dt>
          <dd>{formatMoney(position.metrics.sma20)}</dd>
          <small>SMA20</small>
        </div>
        <div>
          <dt>Difference</dt>
          <dd className={valueTone(position.metrics.signalDifferencePercent)}>
            {formatPercent(position.metrics.signalDifferencePercent) ?? "Not available"}
          </dd>
          <small>SMA5 vs. SMA20</small>
        </div>
      </dl>

      <div className="signal-rule">
        <strong>How the signal is assigned</strong>
        <p>
          BUY when SMA5 is more than 2% above SMA20. SELL when it is more than
          2% below. Otherwise, the signal is HOLD.
        </p>
      </div>
      <p className="signal-footnote">
        Demonstration rule only — not investment advice.
      </p>
    </div>
  );
}

/**
 * Positions arrive as server-rendered props after Supabase has applied RLS.
 * Local state remembers only which row/tab/form the user is looking at; the
 * actual portfolio data remains in Postgres and survives page refreshes.
 */
export default function Dashboard({
  positions,
  portfolioSummary,
  priceCacheUnavailable,
  userEmail,
}: {
  positions: PositionView[];
  portfolioSummary: PortfolioSummary;
  priceCacheUnavailable: boolean;
  userEmail: string;
}) {
  const [selectedId, setSelectedId] = useState(positions[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshState, refreshAction, refreshPending] = useActionState(
    refreshAllPrices,
    emptyActionState,
  );
  const [addState, addAction, addPending] = useActionState(
    addPosition,
    emptyActionState,
  );

  const selectedPosition =
    positions.find((position) => position.id === selectedId) ?? positions[0] ?? null;


  return (
    <div className="app">
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand" aria-label="Stock News Aggregator">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>Stock News Aggregator</span>
          </div>
          <div className="account-area">
            <span className="account-email">{userEmail}</span>
            <form action={logout}>
              <button className="topbar-button">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="shell main-content">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">MARKET INTELLIGENCE</p>
            <h1 id="page-title">My Portfolio</h1>
            <p className="intro-copy">
              Track your U.S. stock positions, closing-price performance, and the
              latest company news in one focused workspace.
            </p>
          </div>
          <form className="refresh-form" action={refreshAction}>
            <button
              className="button button-primary refresh-button"
              disabled={refreshPending}
            >
              {refreshPending ? "Refreshing…" : "Refresh All"}
            </button>
            <Feedback state={refreshState} />
          </form>
        </section>

        {priceCacheUnavailable && (
          <div className="price-cache-notice" role="status">
            <span className="notice-icon" aria-hidden="true">!</span>
            <p>
              <strong>Market data is not ready yet.</strong> Complete the daily-price
              database setup to enable cached closing prices. Your saved holdings
              remain available.
            </p>
          </div>
        )}

        <section className="summary-grid" aria-label="Portfolio summary">
          <div className="summary-card">
            <span className="summary-label">Saved holdings</span>
            <strong className="summary-value">{positions.length}</strong>
            <span className="summary-hint">Stored for this account</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Portfolio market value</span>
            <strong className="summary-value">
              {portfolioSummary.pricedPositions > 0
                ? formatMoney(portfolioSummary.totalMarketValue)
                : "No prices"}
            </strong>
            <span className="summary-hint">
              {portfolioSummary.pricedPositions} of {portfolioSummary.totalPositions} holdings priced
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total unrealized P/L</span>
            <strong
              className={
                "summary-value " +
                (Number(portfolioSummary.totalUnrealizedProfitLoss) >= 0
                  ? "value-positive"
                  : "value-negative")
              }
            >
              {portfolioSummary.pricedPositions > 0
                ? formatSignedMoney(portfolioSummary.totalUnrealizedProfitLoss)
                : "No prices"}
            </strong>
            <span className="summary-hint">Based on the latest cached closes</span>
          </div>
        </section>

        <div className="dashboard-grid">
          <aside className="panel holdings-panel" aria-labelledby="holdings-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">MY ACCOUNT</p>
                <h2 id="holdings-title">My holdings</h2>
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={() => setFormOpen((open) => !open)}
                aria-expanded={formOpen}
                aria-controls="add-holding-form"
              >
                {formOpen ? "Cancel" : "+ Add"}
              </button>
            </div>

            {formOpen && (
              <form className="add-form" id="add-holding-form" action={addAction}>
                <p className="form-note">
                  This row will be saved to your account in Supabase.
                </p>
                <PositionFields />
                <Feedback state={addState} />
                <button className="button button-primary form-submit" disabled={addPending}>
                  {addPending ? "Adding…" : "Add holding"}
                </button>
              </form>
            )}

            {positions.length === 0 ? (
              <div className="empty-small">
                <strong>No holdings yet</strong>
                <p>Add your first symbol, number of shares, and average cost.</p>
              </div>
            ) : (
              <div className="holding-list">
                {positions.map((position) => (
                  <button
                    key={position.id}
                    type="button"
                    className={
                      "holding-item" +
                      (selectedPosition?.id === position.id
                        ? " holding-item-active"
                        : "")
                    }
                    onClick={() => {
                      setSelectedId(position.id);
                      setActiveTab("overview");
                      setEditing(false);
                    }}
                    aria-pressed={selectedPosition?.id === position.id}
                  >
                    <span className="stock-avatar" aria-hidden="true">
                      {position.symbol.slice(0, 1)}
                    </span>
                    <span className="holding-name">
                      <span className="holding-title-row">
                        <strong>{position.symbol}</strong>
                        <small>{formatMoney(position.metrics.latestClose)}</small>
                      </span>
                      <small className="holding-meta">
                        {position.priceStatus === "invalid_symbol"
                          ? "Invalid symbol"
                          : `${formatQuantity(position.quantity)} shares · Avg. ${money.format(Number(position.average_cost))}`}
                      </small>
                    </span>
                    <span className="holding-values">
                      <strong>{formatMoney(position.metrics.marketValue)}</strong>
                      <small className={valueTone(position.metrics.unrealizedProfitLoss)}>
                        {position.metrics.unrealizedProfitLoss === null
                          ? "P/L unavailable"
                          : `${formatSignedMoney(position.metrics.unrealizedProfitLoss)} P/L`}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="panel-footnote">
              Add, edit, and remove operations are checked again on the server.
            </p>
          </aside>

          <section className="panel details-panel" aria-labelledby="details-title">
            {selectedPosition ? (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">HOLDING DETAILS</p>
                    <h2 className="detail-stock-name" id="details-title">
                      {selectedPosition.symbol}
                    </h2>
                  </div>
                  <div className="detail-actions">
                    <button
                      className="button button-light"
                      type="button"
                      onClick={() => setEditing((value) => !value)}
                    >
                      {editing ? "Close edit" : "Edit"}
                    </button>
                    <DeletePositionForm position={selectedPosition} />
                  </div>
                </div>

                {editing && (
                  <div className="edit-form-wrap">
                    <EditPositionForm
                      key={selectedPosition.id}
                      position={selectedPosition}
                      onCancel={() => setEditing(false)}
                    />
                  </div>
                )}

                {selectedPosition.priceStatus === "invalid_symbol" && (
                  <div className="invalid-symbol-notice" role="alert">
                    <strong>Invalid stock symbol.</strong>
                    <p>
                      The price provider could not find {selectedPosition.symbol}.
                      Edit it to a valid U.S. stock symbol or remove this holding.
                    </p>
                  </div>
                )}

                <div className="tabs" role="tablist" aria-label="Holding information">
                  <button
                    id="overview-tab"
                    className={activeTab === "overview" ? "tab tab-active" : "tab"}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "overview"}
                    aria-controls="details-panel"
                    onClick={() => setActiveTab("overview")}
                  >
                    Overview
                  </button>
                  <button
                    id="signal-tab"
                    className={activeTab === "signal" ? "tab tab-active" : "tab"}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "signal"}
                    aria-controls="details-panel"
                    onClick={() => setActiveTab("signal")}
                  >
                    Signal
                  </button>
                  <button
                    id="news-tab"
                    className={activeTab === "news" ? "tab tab-active" : "tab"}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "news"}
                    aria-controls="details-panel"
                    onClick={() => setActiveTab("news")}
                  >
                    News
                  </button>
                </div>

                <div
                  className="tab-content"
                  id="details-panel"
                  role="tabpanel"
                  aria-labelledby={`${activeTab}-tab`}
                >
                  {activeTab === "overview" ? (
                    <div>
                      <div className="price-block">
                        <p className="summary-label">Latest closing price</p>
                        <strong className="price-value">
                          {formatMoney(selectedPosition.metrics.latestClose)}
                        </strong>
                        <p className="price-date">
                          {selectedPosition.priceStatus === "invalid_symbol"
                            ? "No price lookup will be used until the symbol is corrected."
                            : selectedPosition.metrics.priceDate
                            ? `Closing price for ${selectedPosition.metrics.priceDate}`
                            : "No cached daily price is available for this symbol."}
                        </p>
                      </div>
                      <dl className="fact-grid">
                        <div>
                          <dt>Shares held</dt>
                          <dd>{formatQuantity(selectedPosition.quantity)}</dd>
                        </div>
                        <div>
                          <dt>Average cost</dt>
                          <dd>{money.format(Number(selectedPosition.average_cost))}</dd>
                        </div>
                        <div>
                          <dt>Market value</dt>
                          <dd>{formatMoney(selectedPosition.metrics.marketValue)}</dd>
                        </div>
                        <div>
                          <dt>Unrealized P/L</dt>
                          <dd
                            className={
                              "fact-profit-loss " +
                              valueTone(selectedPosition.metrics.unrealizedProfitLoss)
                            }
                          >
                            {formatSignedMoney(
                              selectedPosition.metrics.unrealizedProfitLoss,
                            )}
                            {formatPercent(selectedPosition.metrics.returnPercent) && (
                              <small className="metric-subtext">
                                {formatPercent(selectedPosition.metrics.returnPercent)}
                              </small>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : activeTab === "signal" ? (
                    <SignalPanel position={selectedPosition} />
                  ) : (
                    <NewsPanel
                      key={selectedPosition.symbol}
                      symbol={selectedPosition.symbol}
                      enabled={selectedPosition.priceStatus !== "invalid_symbol"}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="empty-detail">
                <span className="empty-icon" aria-hidden="true">+</span>
                <h2 id="details-title">Add your first holding</h2>
                <p>It will be saved privately to your signed-in account.</p>
              </div>
            )}
          </section>
        </div>

        <footer className="footer">
          Stock News Aggregator is a learning prototype. No brokerage connection
          or investment advice.
        </footer>
      </main>
    </div>
  );
}
