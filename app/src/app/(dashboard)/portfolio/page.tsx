import { getCachedClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { PortfolioView } from "./portfolio-view";

export const dynamic = "force-dynamic";

interface VenturePortfolioData {
  id: string;
  name: string;
  activeBetsCount: number;
  betsHealthDistribution: { green: number; yellow: number; red: number };
  redYellowKpiCount: number;
  openBlockerCount: number;
  highSeverityBlockerCount: number;
  todayPulseCount: number;
  totalMembers: number;
  topAlert: {
    type: "blocker" | "kpi" | "bet";
    label: string;
    severity: "red" | "yellow";
  } | null;
}

interface CrossVentureBlocker {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  venture_name: string;
  venture_id: string;
}

interface CrossVentureCommitment {
  id: string;
  description: string;
  due_date: string | null;
  status: string;
  venture_name: string;
  venture_id: string;
}

interface CrossVentureDecision {
  id: string;
  title: string;
  created_at: string;
  venture_name: string;
  venture_id: string;
}

interface CrossVenturePulse {
  user_id: string;
  user_name: string;
  date: string;
  venture_name: string;
  venture_id: string;
}

export default async function PortfolioPage() {
  const supabase = await getCachedClient();
  const ctx = await getCachedUserContext();

  if (!ctx) {
    redirect("/login");
  }

  if (ctx.isSingleVenture) {
    redirect("/cockpit");
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch all ventures for the org
  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, name")
    .eq("organization_id", ctx.orgId)
    .order("created_at");

  const ventureList = ventures ?? [];

  // For each venture, fetch aggregate metrics in parallel
  const ventureDataPromises = ventureList.map(async (venture): Promise<VenturePortfolioData> => {
    const [
      { data: bets },
      { data: kpis },
      { data: blockers },
      { data: todayPulses },
      { data: members },
    ] = await Promise.all([
      supabase
        .from("bets")
        .select("id, outcome, health_status")
        .eq("organization_id", ctx.orgId)
        .eq("venture_id", venture.id)
        .eq("lifecycle_status", "active"),
      supabase
        .from("kpis")
        .select("id, name, health_status")
        .eq("organization_id", ctx.orgId)
        .eq("venture_id", venture.id)
        .eq("lifecycle_status", "active")
        .in("health_status", ["red", "yellow"]),
      supabase
        .from("blockers")
        .select("id, description, severity")
        .eq("organization_id", ctx.orgId)
        .eq("venture_id", venture.id)
        .eq("resolution_state", "open"),
      supabase
        .from("pulses")
        .select("user_id")
        .eq("organization_id", ctx.orgId)
        .eq("venture_id", venture.id)
        .eq("date", today),
      supabase
        .from("venture_memberships")
        .select("user_id")
        .eq("venture_id", venture.id),
    ]);

    const betList = bets ?? [];
    const kpiList = kpis ?? [];
    const blockerList = blockers ?? [];
    const pulseList = todayPulses ?? [];
    const memberList = members ?? [];

    const distribution = { green: 0, yellow: 0, red: 0 };
    for (const bet of betList) {
      const h = bet.health_status as "green" | "yellow" | "red";
      if (h in distribution) distribution[h]++;
    }

    const highSeverity = blockerList.filter(
      (b) => b.severity === "critical" || b.severity === "high"
    ).length;

    // Determine top alert
    let topAlert: VenturePortfolioData["topAlert"] = null;
    const criticalBlocker = blockerList.find((b) => b.severity === "critical");
    const redKpi = kpiList.find((k) => k.health_status === "red");
    const redBet = betList.find((b) => b.health_status === "red");

    if (criticalBlocker) {
      topAlert = { type: "blocker", label: criticalBlocker.description, severity: "red" };
    } else if (redKpi) {
      topAlert = { type: "kpi", label: `KPI: ${redKpi.name}`, severity: "red" };
    } else if (redBet) {
      topAlert = { type: "bet", label: `Bet: ${redBet.outcome}`, severity: "red" };
    } else if (blockerList.length > 0) {
      topAlert = { type: "blocker", label: blockerList[0].description, severity: "yellow" };
    } else if (kpiList.length > 0) {
      topAlert = { type: "kpi", label: `KPI: ${kpiList[0].name}`, severity: "yellow" };
    }

    return {
      id: venture.id,
      name: venture.name,
      activeBetsCount: betList.length,
      betsHealthDistribution: distribution,
      redYellowKpiCount: kpiList.length,
      openBlockerCount: blockerList.length,
      highSeverityBlockerCount: highSeverity,
      todayPulseCount: pulseList.length,
      totalMembers: memberList.length,
      topAlert,
    };
  });

  // Cross-venture data in parallel
  const [
    ventureData,
    { data: allBlockers },
    { data: allCommitments },
    { data: allDecisions },
    { data: allPulses },
  ] = await Promise.all([
    Promise.all(ventureDataPromises),
    supabase
      .from("blockers")
      .select("id, description, severity, created_at, venture_id")
      .eq("organization_id", ctx.orgId)
      .eq("resolution_state", "open")
      .order("severity")
      .order("created_at"),
    supabase
      .from("commitments")
      .select("id, description, due_date, status, venture_id")
      .eq("organization_id", ctx.orgId)
      .in("status", ["pending", "overdue"])
      .order("due_date"),
    supabase
      .from("decisions")
      .select("id, title, created_at, venture_id")
      .eq("organization_id", ctx.orgId)
      .is("decided_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("pulses")
      .select("user_id, date, venture_id, user_profiles(full_name)")
      .eq("organization_id", ctx.orgId)
      .eq("date", today)
      .order("created_at", { ascending: false }),
  ]);

  const ventureMap = Object.fromEntries(ventureList.map((v) => [v.id, v.name]));

  const crossBlockers: CrossVentureBlocker[] = (allBlockers ?? []).map((b) => ({
    id: b.id,
    description: b.description,
    severity: b.severity,
    created_at: b.created_at,
    venture_name: ventureMap[b.venture_id] ?? "Unknown",
    venture_id: b.venture_id,
  }));

  const crossCommitments: CrossVentureCommitment[] = (allCommitments ?? []).map((c) => ({
    id: c.id,
    description: c.description,
    due_date: c.due_date,
    status: c.status,
    venture_name: ventureMap[c.venture_id] ?? "Unknown",
    venture_id: c.venture_id,
  }));

  const crossDecisions: CrossVentureDecision[] = (allDecisions ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    created_at: d.created_at,
    venture_name: ventureMap[d.venture_id] ?? "Unknown",
    venture_id: d.venture_id,
  }));

  const crossPulses: CrossVenturePulse[] = (allPulses ?? []).map((p: Record<string, unknown>) => {
    const profiles = Array.isArray(p.user_profiles)
      ? (p.user_profiles as Array<{ full_name: string }>)[0]
      : (p.user_profiles as { full_name: string } | null);
    return {
      user_id: p.user_id as string,
      user_name: profiles?.full_name ?? "Unknown",
      date: p.date as string,
      venture_name: ventureMap[p.venture_id as string] ?? "Unknown",
      venture_id: p.venture_id as string,
    };
  });

  return (
    <PortfolioView
      ventures={ventureData}
      crossBlockers={crossBlockers}
      crossCommitments={crossCommitments}
      crossDecisions={crossDecisions}
      crossPulses={crossPulses}
      ventureList={ventureList}
    />
  );
}
