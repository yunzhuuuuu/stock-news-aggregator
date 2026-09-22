import Dashboard from "@/components/dashboard";
import SetupPage from "@/components/setup-page";
import {
  calculatePortfolioSummary,
  calculatePositionMetrics,
} from "@/lib/finance/calculations";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadPriceHistories, loadPriceRefreshStatuses } from "@/lib/prices";
import type { Position, PositionView } from "@/lib/positions";
import { defaultHoldings } from "@/lib/default-holdings";

const demoCreatedAt = "2026-01-01T00:00:00.000Z";

function attachMarketData(
  positions: Position[],
  histories: Awaited<ReturnType<typeof loadPriceHistories>>["histories"],
  statuses: Awaited<ReturnType<typeof loadPriceRefreshStatuses>>["statuses"],
) {
  return positions.map((position): PositionView => ({
    ...position,
    priceStatus: statuses[position.symbol]?.status ?? null,
    priceHistory: histories[position.symbol] ?? [],
    metrics: calculatePositionMetrics(
      position.quantity,
      position.average_cost,
      histories[position.symbol] ?? [],
    ),
  }));
}

/**
 * This Server Component makes the first access decision:
 * 1. Missing configuration -> explain setup.
 * 2. No signed-in user -> show authentication.
 * 3. Signed-in user -> ask Supabase for that user's RLS-filtered positions.
 */
export default async function Home() {
  if (!hasSupabaseConfig()) return <SetupPage />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const demoPositions: Position[] = defaultHoldings.map((holding) => ({
      id: `demo-${holding.symbol.toLowerCase()}`,
      user_id: "guest",
      symbol: holding.symbol,
      quantity: holding.quantity,
      average_cost: holding.averageCost,
      created_at: demoCreatedAt,
      updated_at: demoCreatedAt,
    }));
    const symbols = demoPositions.map((position) => position.symbol);
    let histories: Awaited<ReturnType<typeof loadPriceHistories>>["histories"] = {};
    let statuses: Awaited<ReturnType<typeof loadPriceRefreshStatuses>>["statuses"] = {};
    let priceCacheUnavailable = false;

    try {
      const admin = createAdminClient();
      const [priceResult, statusResult] = await Promise.all([
        loadPriceHistories(admin, symbols),
        loadPriceRefreshStatuses(admin, symbols),
      ]);
      histories = priceResult.histories;
      statuses = statusResult.statuses;
      priceCacheUnavailable = Boolean(priceResult.error);
    } catch {
      priceCacheUnavailable = true;
    }

    const dashboardPositions = attachMarketData(
      demoPositions,
      histories,
      statuses,
    );
    return (
      <Dashboard
        isGuest
        positions={dashboardPositions}
        portfolioSummary={calculatePortfolioSummary(
          dashboardPositions.map((position) => position.metrics),
        )}
        priceCacheUnavailable={priceCacheUnavailable}
        userEmail="Guest preview"
      />
    );
  }

  const { data, error } = await supabase
    .from("positions")
    .select("id,user_id,symbol,quantity,average_cost,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (error) return <SetupPage databaseError={error.message} />;

  const positions = (data ?? []) as Position[];
  const symbols = positions.map((position) => position.symbol);
  const [priceResult, statusResult] = await Promise.all([
    loadPriceHistories(supabase, symbols),
    loadPriceRefreshStatuses(supabase, symbols),
  ]);
  const { histories, error: priceError } = priceResult;
  const dashboardPositions = attachMarketData(
    positions,
    histories,
    statusResult.statuses,
  );
  const portfolioSummary = calculatePortfolioSummary(
    dashboardPositions.map((position) => position.metrics),
  );

  return (
    <Dashboard
      isGuest={false}
      positions={dashboardPositions}
      portfolioSummary={portfolioSummary}
      priceCacheUnavailable={Boolean(priceError)}
      userEmail={user.email ?? "Signed-in user"}
    />
  );
}
