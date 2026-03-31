"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";

type Tab = { label: string; href: string };

export function SectionTabLayout({
  tabs,
  children,
}: {
  tabs: Tab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeLeft, setActiveLeft] = useState(0);
  const [activeWidth, setActiveWidth] = useState(0);
  const [hasMeasured, setHasMeasured] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const measureActiveTab = useCallback(() => {
    const activeHref = tabs.find(
      (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
    )?.href;
    if (!activeHref) {
      setHasMeasured(false);
      return;
    }
    const el = tabRefs.current.get(activeHref);
    if (el) {
      setActiveLeft(el.offsetLeft);
      setActiveWidth(el.offsetWidth);
      setHasMeasured(true);
    }
  }, [pathname, tabs]);

  // Check scroll on mount and scroll events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  // ResizeObserver for scroll check and active tab measurement
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      checkScroll();
      measureActiveTab();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkScroll, measureActiveTab]);

  // Measure active tab on pathname change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measureActiveTab();
  }, [measureActiveTab]);

  const setTabRef = (href: string) => (el: HTMLAnchorElement | null) => {
    if (el) {
      tabRefs.current.set(href, el);
    } else {
      tabRefs.current.delete(href);
    }
  };

  const section = pathname.split("/")[1]; // "strategy", "execution", "reviews", etc.
  const ambientClass =
    section === "strategy"
      ? "section-strategy"
      : section === "execution"
        ? "section-execution"
        : section === "reviews"
          ? "section-reviews"
          : "";

  return (
    <div className={ambientClass}>
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="relative">
          <div
            ref={containerRef}
            className="flex items-center border-b border-line overflow-x-auto"
          >
            {tabs.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  ref={setTabRef(tab.href)}
                  className={`relative flex-shrink-0 px-4 pt-[10px] pb-[12px] text-[13px] transition-[color] duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                    isActive
                      ? "text-ink font-semibold"
                      : "text-faded font-normal hover:text-subtle"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
            {/* Sliding underline indicator */}
            {hasMeasured && (
              <div
                className="absolute bottom-0 h-[2px] bg-accent rounded-t-sm transition-all duration-250"
                style={{ left: activeLeft, width: activeWidth }}
              />
            )}
          </div>
          {/* Scroll gradient overlays */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-canvas to-transparent pointer-events-none z-10" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-canvas to-transparent pointer-events-none z-10" />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
