"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOptionalUserContext } from "@/hooks/use-user-context";

interface NorthStarData {
  bhag: string | null;
  progress: number; // 0-100
  greenCount: number;
  totalCount: number;
}

export function NorthStarDistance() {
  const userCtx = useOptionalUserContext();
  const [data, setData] = useState<NorthStarData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!userCtx?.orgId || !userCtx?.ventureId) return;

    async function load() {
      const supabase = createClient();

      const { data: vision } = await supabase
        .from("visions")
        .select("bhag")
        .eq("venture_id", userCtx!.ventureId)
        .limit(1)
        .maybeSingle();

      const { data: kpis } = await supabase
        .from("kpis")
        .select("id, health_status")
        .eq("organization_id", userCtx!.orgId)
        .eq("lifecycle_status", "active");

      const allKpis = kpis ?? [];
      const greenCount = allKpis.filter(
        (k) => k.health_status === "green"
      ).length;
      const totalCount = allKpis.length;
      const progress =
        totalCount > 0 ? Math.round((greenCount / totalCount) * 100) : 0;

      setData({
        bhag: vision?.bhag ?? null,
        progress,
        greenCount,
        totalCount,
      });

      // Trigger mount animation after data loads
      requestAnimationFrame(() => setMounted(true));
    }

    load();
  }, [userCtx, userCtx?.orgId, userCtx?.ventureId]);

  if (!data || !data.bhag) return null;

  return (
    <div className="px-[18px] py-3.5 mb-4 border-b border-sidebar-divider">
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg
          className={`w-3 h-3 text-sidebar-text-active${data.progress === 100 ? " star-glow" : ""}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
        <p className="font-mono text-[9px] font-semibold text-sidebar-label uppercase tracking-[0.1em]">
          North Star
        </p>
      </div>

      {/* BHAG text — allow 2 lines, tooltip for full text */}
      <p
        className="text-[12px] text-sidebar-text-hover leading-snug line-clamp-2 mb-2"
        title={data.bhag}
      >
        {data.bhag}
      </p>

      {/* Progress bar — animates from 0 on mount */}
      <div className="h-1 rounded-full bg-sidebar-divider overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full bg-sidebar-text-active"
          style={{
            width: mounted ? `${data.progress}%` : "0%",
            transition: "width 700ms ease-out",
          }}
        />
      </div>

      {/* KPI count */}
      <p className="font-mono text-[10px] text-sidebar-text-active">
        {data.progress === 100
          ? `All ${data.totalCount} KPIs green. You've reached the North Star.`
          : data.progress >= 76
            ? `${data.greenCount}/${data.totalCount} on track. The Star is close.`
            : data.progress >= 51
              ? `${data.greenCount}/${data.totalCount} on track. More green than not.`
              : data.progress >= 26
                ? `${data.greenCount}/${data.totalCount} on track. Momentum building.`
                : data.progress >= 1
                  ? `${data.greenCount}/${data.totalCount} on track. The climb has begun.`
                  : `0/${data.totalCount} on track. Long road ahead. Keep going.`}
      </p>
    </div>
  );
}
