import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Vision", href: "/strategy/vision" },
  { label: "Scoreboard", href: "/strategy/scoreboard" },
  { label: "Portfolio", href: "/strategy/portfolio" },
  { label: "Launch", href: "/strategy/launch" },
];

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
