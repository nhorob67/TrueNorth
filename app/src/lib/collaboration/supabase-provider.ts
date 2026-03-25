import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

// ============================================================
// Supabase Realtime Yjs Provider
//
// Uses Supabase Broadcast channels to relay Yjs document updates
// between connected clients, and Presence for awareness (cursors,
// user names, colors).
//
// Lifecycle:
//   1. Connect to a Supabase Realtime channel keyed by document ID
//   2. Load persisted Y.Doc state from the server (ydoc_state column)
//   3. Broadcast local updates to all other clients via the channel
//   4. Listen for remote updates and apply them to local Y.Doc
//   5. Periodically persist the merged Y.Doc state back to the DB
// ============================================================

const PERSIST_INTERVAL_MS = 10_000; // persist every 10s while editing

export interface SupabaseProviderOptions {
  supabase: SupabaseClient;
  documentId: string;
  doc: Y.Doc;
  awareness: Awareness;
  user: { id: string; name: string; color: string };
}

export class SupabaseProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;

  private supabase: SupabaseClient;
  private documentId: string;
  private channel: RealtimeChannel | null = null;
  private persistTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private destroyed = false;
  private user: { id: string; name: string; color: string };
  private isSynced = false;
  private syncListeners: Array<(synced: boolean) => void> = [];

  constructor(opts: SupabaseProviderOptions) {
    this.supabase = opts.supabase;
    this.documentId = opts.documentId;
    this.doc = opts.doc;
    this.awareness = opts.awareness;
    this.user = opts.user;

    this.connect();
  }

  get synced(): boolean {
    return this.isSynced;
  }

  onSync(cb: (synced: boolean) => void): () => void {
    this.syncListeners.push(cb);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== cb);
    };
  }

  private setSynced(synced: boolean) {
    this.isSynced = synced;
    this.syncListeners.forEach((cb) => cb(synced));
  }

  private async connect() {
    // 1. Load persisted state from the DB
    await this.loadPersistedState();

    if (this.destroyed) return;

    // 2. Join a Supabase Realtime channel
    const channelName = `collab:${this.documentId}`;
    this.channel = this.supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // Listen for document updates from other clients
    this.channel.on("broadcast", { event: "yjs-update" }, (payload) => {
      const update = base64ToUint8Array(payload.payload.update);
      Y.applyUpdate(this.doc, update, "remote");
    });

    // Listen for awareness updates from other clients
    this.channel.on("broadcast", { event: "yjs-awareness" }, (payload) => {
      const update = base64ToUint8Array(payload.payload.update);
      // Import awareness protocol to apply update
      import("y-protocols/awareness").then(({ applyAwarenessUpdate }) => {
        applyAwarenessUpdate(this.awareness, update, "remote");
      });
    });

    // Track presence for online collaborators
    this.channel.on("presence", { event: "sync" }, () => {
      // Presence synced — we could use this for a collaborator list
    });

    await this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Set our awareness state
        this.awareness.setLocalStateField("user", {
          id: this.user.id,
          name: this.user.name,
          color: this.user.color,
        });

        // Track presence
        await this.channel?.track({
          userId: this.user.id,
          name: this.user.name,
          color: this.user.color,
        });

        this.setSynced(true);
      }
    });

    // 3. Listen for local Y.Doc updates and broadcast them
    this.doc.on("update", this.handleDocUpdate);

    // 4. Listen for local awareness changes and broadcast them
    this.awareness.on("update", this.handleAwarenessUpdate);

    // 5. Start periodic persistence
    this.persistTimer = setInterval(() => {
      if (this.dirty) {
        this.persistState();
      }
    }, PERSIST_INTERVAL_MS);
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return; // Don't re-broadcast remote updates
    this.dirty = true;

    this.channel?.send({
      type: "broadcast",
      event: "yjs-update",
      payload: { update: uint8ArrayToBase64(update) },
    });
  };

  private handleAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    const changedClients = added.concat(updated).concat(removed);
    // Only broadcast if we have changes and the channel is connected
    if (changedClients.length === 0 || !this.channel) return;

    import("y-protocols/awareness").then(({ encodeAwarenessUpdate }) => {
      const update = encodeAwarenessUpdate(this.awareness, changedClients);
      this.channel?.send({
        type: "broadcast",
        event: "yjs-awareness",
        payload: { update: uint8ArrayToBase64(update) },
      });
    });
  };

  private async loadPersistedState() {
    try {
      const res = await fetch(
        `/api/collaboration/${this.documentId}`,
        { method: "GET" }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.ydocState) {
          const state = base64ToUint8Array(data.ydocState);
          Y.applyUpdate(this.doc, state, "remote");
        } else if (data.bodyJson && Object.keys(data.bodyJson).length > 0) {
          // No ydoc state yet — initial content is in body_json
          // The editor will handle setting initial content from body_json
        }
      }
    } catch (err) {
      console.error("[SupabaseProvider] Failed to load persisted state:", err);
    }
  }

  private async persistState() {
    if (this.destroyed) return;
    this.dirty = false;

    try {
      const state = Y.encodeStateAsUpdate(this.doc);
      await fetch(`/api/collaboration/${this.documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ydocState: uint8ArrayToBase64(state),
        }),
      });
    } catch (err) {
      console.error("[SupabaseProvider] Failed to persist state:", err);
      this.dirty = true; // Retry next interval
    }
  }

  async destroy() {
    this.destroyed = true;

    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }

    // Final persist before disconnecting
    if (this.dirty) {
      await this.persistState();
    }

    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);

    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.setSynced(false);
  }
}

// ============================================================
// Base64 <-> Uint8Array helpers
// ============================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
