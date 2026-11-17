"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { hostOf } from "@/lib/format";

const cache = new Map<string, string>();

/**
 * The name the owner gave a shop, for breadcrumbs and headings. Until it loads (or for the
 * public sample, which has no shop record) the domain is shown instead of a placeholder.
 */
export function useShopName(shopId: string | undefined, url: string | undefined, enabled = true): string {
  const [fetched, setFetched] = useState<{ id: string; name: string }>();

  useEffect(() => {
    if (!shopId || !enabled || cache.has(shopId)) return;
    let alive = true;
    api.getShop(shopId)
      .then((shop) => {
        const name = shop.nickname?.trim() || hostOf(shop.url || url || "");
        cache.set(shopId, name);
        if (alive) setFetched({ id: shopId, name });
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [shopId, url, enabled]);

  const known = shopId ? cache.get(shopId) ?? (fetched?.id === shopId ? fetched.name : undefined) : undefined;
  return known || (url ? hostOf(url) : "");
}
