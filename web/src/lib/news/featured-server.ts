import "server-only";

import {
  claimNewsRefresh,
  completeNewsRefresh,
  loadCachedNewsArticles,
  persistNewsArticles,
} from "@/lib/news/storage";
import { refreshNewsCache } from "@/lib/news/refresh";
import { createMarketauxProvider } from "@/lib/providers/marketaux";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FeaturedNewsItem } from "@/lib/finance/featured";

const fallbackSymbols = ["META", "TSLA"];

function deduplicate(items: FeaturedNewsItem[]) {
  return [...new Map(
    items.map((item) => [item.article.id, item]),
  ).values()];
}

async function readCachedSymbols(
  symbols: string[],
): Promise<FeaturedNewsItem[]> {
  const admin = createAdminClient();
  const results = await Promise.all(
    [...new Set(symbols)].map(async (symbol) => {
      try {
        const articles = await loadCachedNewsArticles(admin, symbol);
        return articles.map((article) => ({ symbol, article }));
      } catch {
        return [];
      }
    }),
  );
  return deduplicate(results.flat());
}

async function loadFallbackNews(): Promise<FeaturedNewsItem[]> {
  const admin = createAdminClient();
  const provider = createMarketauxProvider(process.env.MARKETAUX_API_TOKEN ?? "");
  const results = await Promise.all(
    fallbackSymbols.map(async (symbol) => {
      try {
        const result = await refreshNewsCache({
          loadCached: () => loadCachedNewsArticles(admin, symbol),
          claim: () => claimNewsRefresh(admin, symbol),
          fetchArticles: () => provider.fetchArticles([symbol]),
          persist: (articles) => persistNewsArticles(admin, articles),
          complete: (success, error) =>
            completeNewsRefresh(admin, symbol, success, error),
        });
        const article = result.articles[0];
        return article ? [{ symbol, article }] : [];
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

/**
 * Normal page loads read only the shared cache. Provider-backed META and TSLA
 * fallback is used only when fewer than two distinct cached articles exist.
 */
export async function loadFeaturedNewsPool(symbols: string[]) {
  const cached = await readCachedSymbols(symbols);
  if (cached.length >= 2) return cached;

  const fallback = await loadFallbackNews().catch(() => []);
  return deduplicate([...cached, ...fallback]);
}
