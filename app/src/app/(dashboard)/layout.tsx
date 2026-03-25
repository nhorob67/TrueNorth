import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { UserContextProvider } from "@/hooks/use-user-context";
import { getCachedUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userContext = await getCachedUserContext();

  if (!userContext) {
    redirect("/login");
  }

  return (
    <UserContextProvider value={userContext}>
      <AppShell>{children}</AppShell>
    </UserContextProvider>
  );
}
