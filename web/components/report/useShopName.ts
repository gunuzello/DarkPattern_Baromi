"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { hostOf } from "@/lib/format";

const cache = new Map<string, string>();

/**
 * The name the owner gave a shop (falls back to its domain), for breadcrumbs and headings.
 * Skipped for the public sample, which has no shop record.
 */
export function useShopName(shopId: string | undefined, url: string | undefined, enabled = true): string {
  const fallback = url ? hostOf(url) : "쇼핑몰";
  const [name, setName] = useState(() => (shopId && cache.get(shopId)) || fallback);

  useEffect(() => {
    if (!shopId || !enabled) return;
    let alive = true;
    api.getShop(shopId)
      .then((shop) => {
        const next = shop.nickname?.trim() || hostOf(shop.url || url || "");
        cache.set(shopId, next);
        if (alive) setName(next);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [shopId, url, enabled]);

  return name || fallback;
}
