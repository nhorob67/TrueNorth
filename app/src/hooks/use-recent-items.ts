"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "truenorth-recent-items";
const MAX_ITEMS = 5;

export interface RecentItem {
  label: string;
  href: string;
  type?: string;
  timestamp: number;
}

export function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setItems(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const addRecentItem = useCallback((item: Omit<RecentItem, "timestamp">) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.href !== item.href);
      const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const clearRecentItems = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { recentItems: items, addRecentItem, clearRecentItems };
}
