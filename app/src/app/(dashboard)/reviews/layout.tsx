import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Sync", href: "/reviews/sync" },
  { label: "Operations", href: "/reviews/operations" },
  { label: "Health", href: "/reviews/health" },
  { label: "Narratives", href: "/reviews/narratives" },
  { label: "Pulse", href: "/reviews/pulse" },
];

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
