"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getEntityHref } from "@/lib/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  entity_id: string | null;
  entity_type: string | null;
  created_at: string;
}

export function NotificationBell() {
  const supabase = createClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const [badgePulse, setBadgePulse] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .or(`held_until.is.null,held_until.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(20);

    const items = (data ?? []) as Notification[];
    setNotifications(items);
    const newCount = items.filter((n) => !n.read).length;

    // Pulse badge when count increases
    if (newCount > prevCountRef.current && prevCountRef.current >= 0) {
      setBadgePulse(true);
      setTimeout(() => setBadgePulse(false), 400);
    }
    prevCountRef.current = newCount;
    setUnreadCount(newCount);
  }, [supabase]);

  // Initial load + Supabase Realtime subscription
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .or(`held_until.is.null,held_until.lte.${new Date().toISOString()}`);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function handleNotificationClick(n: Notification) {
    if (!n.read) markRead(n.id);
    const href = getEntityHref(n.entity_type, n.entity_id);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-sidebar-text hover:text-sidebar-text-hover hover:bg-sidebar-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-semantic-brick text-white text-[10px] flex items-center justify-center font-bold transition-transform duration-300 ${badgePulse ? "scale-125" : "scale-100"}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-line bg-surface shadow-lg max-h-96 overflow-auto z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-accent hover:text-accent-warm transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-subtle p-3">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-3 py-2 border-b border-line last:border-0 transition-colors hover:bg-hovered ${!n.read ? "bg-accent/5" : ""} ${n.entity_type && n.entity_id ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  )}
                  <div className={!n.read ? "" : "pl-3.5"}>
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-subtle mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-xs text-faded mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
