"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { label: string; href: string };

export function SectionTabLayout({
  tabs,
  children,
}: {
  tabs: Tab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="flex items-center border-b border-line overflow-x-auto">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex-shrink-0 px-4 pt-[10px] pb-[12px] text-[13px] transition-[color] duration-150 ease-in-out ${
                  isActive
                    ? "text-ink font-semibold tab-active"
                    : "text-faded font-normal hover:text-subtle"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
