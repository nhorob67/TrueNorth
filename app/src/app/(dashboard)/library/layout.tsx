import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Processes", href: "/library/processes" },
  { label: "Artifacts", href: "/library/artifacts" },
];

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
