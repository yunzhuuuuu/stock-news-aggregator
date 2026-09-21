import type { PositionMetrics } from "@/lib/finance/calculations";
import type { PriceRefreshStatus } from "@/lib/prices";

/** A database row after Supabase converts snake_case column names. */
export type Position = {
  id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  average_cost: number;
  created_at: string;
  updated_at: string;
};

/** The Server Component attaches calculations before data reaches the UI. */
export type PositionView = Position & {
  metrics: PositionMetrics;
  priceStatus: PriceRefreshStatus | null;
};

export type ActionState = {
  error?: string;
  message?: string;
};

export const emptyActionState: ActionState = {};
