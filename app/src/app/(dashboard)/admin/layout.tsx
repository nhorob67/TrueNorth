import { SectionTabLayout } from "@/components/layout/section-tab-layout";

const TABS = [
  { label: "Settings", href: "/admin/settings" },
  { label: "Cron Jobs", href: "/admin/settings/cron" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SectionTabLayout tabs={TABS}>{children}</SectionTabLayout>;
}
