import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Bets", href: "/execution/bets" },
  { label: "Ideas", href: "/execution/ideas" },
  { label: "Funnels", href: "/execution/funnels" },
  { label: "Content", href: "/execution/content" },
];

export default function ExecutionLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
