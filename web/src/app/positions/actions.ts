"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ensureRecentDailyPrice,
  refreshAndStoreDailyPrices,
} from "@/lib/prices/refresh-server";
import type { ActionState } from "@/lib/positions";

const symbolPattern = /^[A-Z][A-Z0-9.-]{0,5}$/;

function parsePosition(formData: FormData) {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const quantity = Number(formData.get("quantity"));
  const averageCost = Number(formData.get("averageCost"));

  if (!symbolPattern.test(symbol)) {
    return { error: "Use a 1–6 character stock symbol." } as const;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Shares must be greater than zero." } as const;
  }
  if (!Number.isFinite(averageCost) || averageCost < 0) {
    return { error: "Average cost must be zero or greater." } as const;
  }

  return { symbol, quantity, averageCost } as const;
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function refreshMessage(symbol: string, savedMessage: string) {
  try {
    const result = await ensureRecentDailyPrice(symbol);
    if (!result) return `${savedMessage} A recent shared price is already available.`;
    if (result.status === "updated") {
      return `${savedMessage} Its latest daily prices were refreshed.`;
    }
    if (result.code === "INVALID_SYMBOL") {
      return `${savedMessage} The price provider could not find this stock symbol.`;
    }
    return `${savedMessage} The price refresh failed temporarily and can be retried later.`;
  } catch {
    // Saving the private position is the primary action. A provider or cache
    // failure must not undo it or expose internal server errors to the user.
    return `${savedMessage} The price refresh is temporarily unavailable.`;
  }
}

/**
 * Validation is repeated on the server. Browser validation is helpful feedback,
 * while server validation is what protects the database from crafted requests.
 */
export async function addPosition(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = parsePosition(formData);
  if ("error" in values) return { error: values.error };

  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.from("positions").insert({
    user_id: user.id,
    symbol: values.symbol,
    quantity: values.quantity,
    average_cost: values.averageCost,
  });

  if (error?.code === "23505") return { error: "That symbol is already in your portfolio." };
  if (error) return { error: error.message };

  const message = await refreshMessage(values.symbol, `${values.symbol} was added.`);
  revalidatePath("/");
  return { message };
}

export async function updatePosition(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const values = parsePosition(formData);
  if (!id) return { error: "The position ID is missing." };
  if ("error" in values) return { error: values.error };

  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("positions")
    .update({
      symbol: values.symbol,
      quantity: values.quantity,
      average_cost: values.averageCost,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error?.code === "23505") return { error: "That symbol is already in your portfolio." };
  if (error) return { error: error.message };

  const message = await refreshMessage(values.symbol, `${values.symbol} was updated.`);
  revalidatePath("/");
  return { message };
}

export async function deletePosition(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "The position ID is missing." };

  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { message: "The position was removed." };
}

/**
 * Refresh every symbol in the signed-in user's portfolio. The browser never
 * receives the provider key: this action reads the user's RLS-filtered rows,
 * then calls the existing server-only price provider and shared cache.
 */
export async function refreshAllPrices(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  // React supplies both values to every action-state handler. This refresh
  // action does not need form fields because it reads symbols from the account.
  void _previousState;
  void _formData;

  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data, error } = await supabase
    .from("positions")
    .select("symbol")
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  const symbols = [...new Set((data ?? []).map((row) => String(row.symbol)))];
  if (symbols.length === 0) {
    return { message: "Add a holding before refreshing prices." };
  }

  try {
    const results = await refreshAndStoreDailyPrices(symbols);
    const updated = results.filter((result) => result.status === "updated").length;
    const failed = results.length - updated;

    revalidatePath("/");
    if (failed > 0) {
      return {
        message: `Refreshed ${updated} of ${results.length} holdings. ${failed} could not be updated.`,
      };
    }
    return { message: `Refreshed all ${updated} holdings.` };
  } catch {
    return { error: "Prices could not be refreshed right now. Please try again later." };
  }
}
