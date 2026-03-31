import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Processes", href: "/library/processes" },
  { label: "Artifacts", href: "/library/artifacts" },
  { label: "Agents", href: "/library/agents" },
  { label: "Knowledge", href: "/library/knowledge" },
];

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
