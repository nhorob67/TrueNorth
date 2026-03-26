"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { QuickTodoModal } from "@/components/quick-todo-modal";
import { CommandPalette } from "@/components/command-palette";
import { TodoSlideOver } from "@/components/todo-slide-over";
import { useOptionalUserContext } from "@/hooks/use-user-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickTodoOpen, setQuickTodoOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [todoSlideOverOpen, setTodoSlideOverOpen] = useState(false);
  const ctx = useOptionalUserContext();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const closeQuickTodo = useCallback(() => setQuickTodoOpen(false), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);
  const closeTodoSlideOver = useCallback(() => setTodoSlideOverOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSidebar();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+T — Quick todo creation
      if (meta && !e.shiftKey && e.key === "t") {
        e.preventDefault();
        if (ctx) setQuickTodoOpen(true);
        return;
      }

      // Cmd+K — Command palette
      if (meta && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+Shift+T — Todos slide-over
      if (meta && e.shiftKey && e.key === "T") {
        e.preventDefault();
        if (ctx) setTodoSlideOverOpen((prev) => !prev);
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ctx]);

  return (
    <div className="flex min-h-screen">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-cta focus:text-cta-text focus:rounded-[8px] focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/50 z-40 lg:hidden transition-opacity duration-200"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: hidden on mobile unless toggled */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar />
      </div>

      <main id="main-content" className="flex-1 bg-canvas min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-sidebar text-sidebar-text-hover">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="p-1 -ml-1 rounded-lg hover:bg-sidebar-hover transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="font-display font-bold">TrueNorth</span>
        </div>

        <div className="px-4 py-4 md:px-8 md:py-6 pb-20 md:pb-6">{children}</div>
      </main>

      <MobileNav />
      <InstallPrompt />
      <QuickTodoModal
        open={quickTodoOpen}
        onClose={closeQuickTodo}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        onOpenQuickTodo={ctx ? () => setQuickTodoOpen(true) : undefined}
        onOpenTodoSlideOver={ctx ? () => setTodoSlideOverOpen(true) : undefined}
      />
      <TodoSlideOver
        open={todoSlideOverOpen}
        onClose={closeTodoSlideOver}
      />
    </div>
  );
}
