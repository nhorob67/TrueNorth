"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  strategy: "Strategy",
  execution: "Execution",
  reviews: "Reviews",
  library: "Library",
  admin: "Admin",
  vision: "Vision",
  scoreboard: "Scoreboard",
  portfolio: "Portfolio",
  bets: "Bets",
  ideas: "Ideas",
  funnels: "Funnels",
  content: "Content",
  sync: "Sync",
  cockpit: "Cockpit",
  pulse: "Pulse",
  operations: "Operations",
  health: "Health",
  narratives: "Narratives",
  processes: "Processes",
  artifacts: "Artifacts",
  activity: "Activity",
  todos: "Todos",
  profile: "Profile",
  settings: "Settings",
  agents: "Agents",
  policies: "Policies",
  automation: "Automation",
  new: "New",
};

interface BreadcrumbProps {
  /** Override the final crumb label (e.g. for entity names) */
  currentLabel?: string;
}

export function Breadcrumb({ currentLabel }: BreadcrumbProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on top-level pages
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    const label = isLast && currentLabel ? currentLabel : ROUTE_LABELS[seg] ?? seg;

    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.10em] text-faded">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg className="w-3 h-3 text-faded/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            )}
            {crumb.isLast ? (
              <span className="text-subtle" aria-current="page">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-subtle transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
