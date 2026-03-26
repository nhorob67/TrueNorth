"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import { createClient } from "@/lib/supabase/client";
import { SupabaseProvider } from "@/lib/collaboration/supabase-provider";

// ============================================================
// useCollaboration Hook
//
// Initializes a Y.Doc + Supabase Realtime provider for a given
// document ID. Returns the ydoc, provider, and awareness objects
// that get passed into Tiptap's Collaboration extensions.
//
// Also sets up IndexedDB persistence for offline PWA support.
// ============================================================

// 12 distinct cursor colors so collaborators are visually distinguishable
const CURSOR_COLORS = [
  "#B85C38", // clay
  "#5F6F52", // moss
  "#B69A45", // brass
  "#8B9E82", // sage
  "#A04230", // brick
  "#6B8C54", // green
  "#C49B2D", // ochre
  "#7A756E", // warm-gray
  "#4A90D9", // blue
  "#9B59B6", // purple
  "#E67E22", // orange
  "#1ABC9C", // teal
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export interface CollaborationState {
  ydoc: Y.Doc;
  provider: SupabaseProvider | null;
  awareness: Awareness;
  isReady: boolean;
  isSynced: boolean;
  collaborators: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export function useCollaboration(
  documentId: string,
  user: { id: string; name: string }
): CollaborationState {
  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const providerRef = useRef<SupabaseProvider | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [collaborators, setCollaborators] = useState<
    Array<{ id: string; name: string; color: string }>
  >([]);

  // Stable ydoc + awareness (created once per document)
  const { ydoc, awareness } = useMemo(() => {
    // Clean up previous if document ID changed
    if (ydocRef.current) {
      ydocRef.current.destroy();
    }
    const doc = new Y.Doc();
    const aw = new Awareness(doc);
    ydocRef.current = doc;
    awarenessRef.current = aw;
    return { ydoc: doc, awareness: aw };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    const supabase = createClient();
    const color = pickColor(user.id);

    // IndexedDB persistence for offline support
    const idb = new IndexeddbPersistence(`truenorth-collab-${documentId}`, ydoc);
    idbRef.current = idb;

    // Mark as ready once IndexedDB has loaded (or immediately if empty)
    idb.once("synced", () => setIsReady(true));

    // Supabase Realtime provider
    const provider = new SupabaseProvider({
      supabase,
      documentId,
      doc: ydoc,
      awareness,
      user: { id: user.id, name: user.name, color },
    });
    providerRef.current = provider;

    const unsubSync = provider.onSync(setIsSynced);

    // Track collaborators from awareness
    const updateCollaborators = () => {
      const states = awareness.getStates();
      const collabs: Array<{ id: string; name: string; color: string }> = [];
      states.forEach((state: Record<string, unknown>, clientId: number) => {
        if (clientId === ydoc.clientID) return; // exclude self
        const u = state.user as { id: string; name: string; color: string } | undefined;
        if (u) {
          collabs.push(u);
        }
      });
      setCollaborators(collabs);
    };

    awareness.on("change", updateCollaborators);
    updateCollaborators();

    return () => {
      awareness.off("change", updateCollaborators);
      unsubSync();
      provider.destroy();
      idb.destroy();
      providerRef.current = null;
      idbRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, user.id, user.name]);

  return {
    ydoc,
    provider: providerRef.current,
    awareness,
    isReady,
    isSynced,
    collaborators,
  };
}
