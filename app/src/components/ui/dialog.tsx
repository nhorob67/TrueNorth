"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function Dialog({ open, onClose, children, title, description }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useFocusTrap(dialogRef, visible && !animating, onClose);

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
      // Exit animation
      setAnimating(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        setAnimating(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open, visible]);

  if (!visible) return null;

  const entering = open && !animating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-ink/50 transition-opacity duration-200 ${entering ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
        className={`relative z-50 w-full max-w-lg mx-4 bg-surface border border-line rounded-xl shadow-xl transition-all ${entering ? "opacity-100 scale-100 duration-250" : "opacity-0 scale-95 duration-150"}`}
        style={{ transitionTimingFunction: entering ? "var(--easing-spring)" : "ease-in" }}
      >
        {(title || description) && (
          <div className="px-6 pt-6 pb-2">
            {title && (
              <h2 id="dialog-title" className="text-lg font-semibold font-display text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-description" className="mt-1 text-sm text-subtle">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export function DialogFooter({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-end gap-2 pt-4 border-t border-line -mx-6 px-6 pb-2 ${className}`}
      {...props}
    />
  );
}
