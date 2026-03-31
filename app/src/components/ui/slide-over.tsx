"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useSwipeToDismiss } from "@/hooks/use-swipe-dismiss";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

const widthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function SlideOver({ open, onClose, title, children, width = "md" }: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const entering = open && !animating;
  const exiting = !open && visible;

  useFocusTrap(panelRef, visible && entering, onClose);

  const { offset, swiping } = useSwipeToDismiss(panelRef, onClose, {
    threshold: 100,
    enabled: visible && !animating,
  });

  // Handle open/close with animation
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimating(true);
      setVisible(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(false));
      });
    } else if (visible) {
      setAnimating(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        setAnimating(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-ink/50 transition-opacity duration-200 ${entering ? "opacity-100 animate-fade-in" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-50 w-full ${widthMap[width]} bg-surface border-l border-line shadow-xl h-full flex flex-col ${entering ? "animate-slide-in-right" : ""} ${exiting ? "animate-slide-out-right" : ""}`}
        style={{
          transform: offset > 0 ? `translateX(${offset}px)` : undefined,
          transition: swiping ? "none" : undefined,
          touchAction: "pan-y",
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <h2 className="text-lg font-semibold font-display text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-subtle hover:text-ink hover:bg-hovered transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
