import AuthPage from "@/components/auth-page";
import Dashboard from "@/components/dashboard";
import SetupPage from "@/components/setup-page";
import {
  calculatePortfolioSummary,
  calculatePositionMetrics,
} from "@/lib/finance/calculations";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { loadPriceHistories, loadPriceRefreshStatuses } from "@/lib/prices";
import type { Position, PositionView } from "@/lib/positions";

type HomeProps = {
  searchParams: Promise<{ authError?: string }>;
};

/**
 * This Server Component makes the first access decision:
 * 1. Missing configuration -> explain setup.
 * 2. No signed-in user -> show authentication.
 * 3. Signed-in user -> ask Supabase for that user's RLS-filtered positions.
 */
export default async function Home({ searchParams }: HomeProps) {
  if (!hasSupabaseConfig()) return <SetupPage />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { authError } = await searchParams;
    return <AuthPage authError={authError} />;
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
  const dashboardPositions: PositionView[] = positions.map((position) => ({
    ...position,
    priceStatus: statusResult.statuses[position.symbol]?.status ?? null,
    metrics: calculatePositionMetrics(
      position.quantity,
      position.average_cost,
      histories[position.symbol] ?? [],
    ),
  }));
  const portfolioSummary = calculatePortfolioSummary(
    dashboardPositions.map((position) => position.metrics),
  );

  return (
    <Dashboard
      positions={dashboardPositions}
      portfolioSummary={portfolioSummary}
      priceCacheUnavailable={Boolean(priceError)}
      userEmail={user.email ?? "Signed-in user"}
    />
  );
}
