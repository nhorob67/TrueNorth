import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Settings", href: "/admin/settings" },
  { label: "Cron & Schedules", href: "/admin/settings/cron" },
  { label: "Token Costs", href: "/admin/settings/costs" },
  { label: "Workflows", href: "/admin/settings/workflows" },
  { label: "Skills", href: "/admin/settings/skills" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
