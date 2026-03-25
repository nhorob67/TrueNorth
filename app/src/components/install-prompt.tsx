"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed silently
      });
    }

    function handlePrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-surface border border-line rounded-lg shadow-lg p-4 z-50">
      <p className="text-sm font-medium text-ink">Install TrueNorth</p>
      <p className="text-xs text-subtle mt-1">
        Add TrueNorth to your home screen for quick access.
      </p>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={async () => {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") {
              setDeferredPrompt(null);
            }
          }}
        >
          Install
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDismissed(true)}
        >
          Not now
        </Button>
      </div>
    </div>
  );
}
