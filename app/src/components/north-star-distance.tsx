"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOptionalUserContext } from "@/hooks/use-user-context";

// ============================================================
// North Star Distance Visual (Gamification 3.15)
//
// Compact visual showing BHAG progress as a percentage arc.
// Progress = % of annual outcomes achieved (green KPIs / total).
// ============================================================

interface NorthStarData {
  bhag: string | null;
  progress: number; // 0-100
  greenCount: number;
  totalCount: number;
}

export function NorthStarDistance() {
  const userCtx = useOptionalUserContext();
  const [data, setData] = useState<NorthStarData | null>(null);

  useEffect(() => {
    if (!userCtx?.orgId || !userCtx?.ventureId) return;

    async function load() {
      const supabase = createClient();

      // Fetch vision BHAG
      const { data: vision } = await supabase
        .from("visions")
        .select("bhag")
        .eq("venture_id", userCtx!.ventureId)
        .limit(1)
        .maybeSingle();

      // Fetch active KPIs linked to outcomes
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
    }

    load();
  }, [userCtx?.orgId, userCtx?.ventureId]);

  if (!data || !data.bhag) return null;

  // SVG arc parameters
  const size = 32;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (data.progress / 100) * circumference;

  return (
    <div className="px-4 py-3 mb-2">
      <div className="flex items-center gap-2.5">
        {/* Progress arc */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={strokeWidth}
            />
            {/* Progress arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          </svg>
          {/* Star icon center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5 text-white/70"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          </div>
        </div>

        {/* BHAG text + progress */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-medium text-white/50 uppercase tracking-wider leading-tight"
          >
            North Star
          </p>
          <p className="text-xs text-white/80 leading-tight truncate">
            {data.bhag.length > 40
              ? data.bhag.slice(0, 40) + "..."
              : data.bhag}
          </p>
          <p className="text-[10px] text-white/50 mt-0.5">
            {data.progress}% ({data.greenCount}/{data.totalCount} KPIs green)
          </p>
        </div>
      </div>
    </div>
  );
}
