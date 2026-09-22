import type { CachedNewsArticle } from "@/lib/news/types";

export type FeaturedNewsItem = {
  symbol: string;
  article: CachedNewsArticle;
};

function deduplicate(items: FeaturedNewsItem[]) {
  return [...new Map(
    items.map((item) => [item.article.id, item]),
  ).values()];
}

/**
 * Pick cached articles without replacement. When enough alternatives exist,
 * refreshes exclude the currently displayed articles so the change is visible.
 */
export function selectRandomFeaturedNews(
  items: FeaturedNewsItem[],
  count = 2,
  random: () => number = Math.random,
  excludedArticleIds: string[] = [],
): FeaturedNewsItem[] {
  const unique = deduplicate(items);
  const excluded = new Set(excludedArticleIds);
  const alternatives = unique.filter((item) => !excluded.has(item.article.id));
  const candidates = alternatives.length >= count ? alternatives : unique;
  const shuffled = [...candidates];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, count);
}
