"use client";

import { useState, useEffect, useRef, type RefObject } from "react";

interface SwipeDismissOptions {
  threshold?: number;
  enabled?: boolean;
}

/**
 * Swipe-to-dismiss hook for right-side panels (SlideOver).
 * Only activates when the touch starts near the left edge of the panel.
 * Returns offset and swiping state for inline transform application.
 */
export function useSwipeToDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  options: SwipeDismissOptions = {}
): { offset: number; swiping: boolean } {
  const { threshold = 100, enabled = true } = options;
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const directionLockedRef = useRef(false);
  const isHorizontalRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      // Only activate if touch starts within 30px of panel left edge
      if (e.clientX - rect.left > 30) return;

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      directionLockedRef.current = false;
      isHorizontalRef.current = false;
      setSwiping(true);
      el!.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!swiping && offset === 0) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      // Lock direction after 10px of movement
      if (!directionLockedRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        directionLockedRef.current = true;
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
        if (!isHorizontalRef.current) {
          setSwiping(false);
          return;
        }
      }

      if (!isHorizontalRef.current) return;

      // Only allow rightward swipe (positive dx)
      setOffset(Math.max(0, dx));
    }

    function onPointerUp() {
      if (offset > threshold) {
        onDismiss();
      }
      setOffset(0);
      setSwiping(false);
      directionLockedRef.current = false;
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [ref, enabled, threshold, onDismiss, swiping, offset]);

  return { offset, swiping };
}
