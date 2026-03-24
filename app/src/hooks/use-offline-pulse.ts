"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface OfflinePulseData {
  user_id: string;
  organization_id: string;
  venture_id: string | null;
  date: string;
  items: Array<{
    type: "shipped" | "focus" | "blockers" | "signal";
    text: string;
    linked_entity_ids?: string[];
    mentions?: string[];
  }>;
}

interface PendingPulse extends OfflinePulseData {
  id: number;
  queued_at: number;
}

/**
 * Hook for offline-first pulse capture.
 *
 * - Tracks online/offline state
 * - Stores pulse drafts in IndexedDB via the service worker when offline
 * - Syncs queued pulses when connectivity is restored
 */
export function useOfflinePulse(onSync: (pulse: OfflinePulseData) => Promise<boolean>) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Track online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check for pending pulses on mount
  useEffect(() => {
    refreshPendingCount();
  }, []);

  function refreshPendingCount() {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PENDING_PULSES") {
        setPendingCount(event.data.pulses?.length ?? 0);
        navigator.serviceWorker.removeEventListener("message", handler);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    navigator.serviceWorker.controller.postMessage({ type: "GET_PENDING_PULSES" });
  }

  // Sync pending pulses when we come back online
  const syncPending = useCallback(async () => {
    if (syncingRef.current) return;
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;

    syncingRef.current = true;
    setSyncing(true);

    try {
      const pulses = await new Promise<PendingPulse[]>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === "PENDING_PULSES") {
            resolve(event.data.pulses ?? []);
            navigator.serviceWorker.removeEventListener("message", handler);
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        navigator.serviceWorker.controller!.postMessage({ type: "GET_PENDING_PULSES" });

        // Timeout after 3s
        setTimeout(() => resolve([]), 3000);
      });

      for (const pulse of pulses) {
        const { id, queued_at, ...pulseData } = pulse;
        const success = await onSync(pulseData);
        if (success) {
          navigator.serviceWorker.controller!.postMessage({
            type: "DELETE_SYNCED_PULSE",
            id,
          });
        }
      }

      refreshPendingCount();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [onSync]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncPending();
    }
  }, [isOnline, pendingCount, syncPending]);

  /** Queue a pulse for offline storage via the service worker. */
  const storeOffline = useCallback(async (pulse: OfflinePulseData): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
      return false;
    }

    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "PULSE_STORED") {
          setPendingCount((c) => c + 1);
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve(true);
        }
        if (event.data?.type === "PULSE_STORE_ERROR") {
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve(false);
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      navigator.serviceWorker.controller!.postMessage({
        type: "STORE_OFFLINE_PULSE",
        pulse,
      });

      // Timeout fallback
      setTimeout(() => resolve(false), 3000);
    });
  }, []);

  return {
    isOnline,
    pendingCount,
    syncing,
    storeOffline,
    syncPending,
  };
}
