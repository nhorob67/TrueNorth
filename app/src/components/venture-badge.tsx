"use client";

import { useOptionalUserContext } from "@/hooks/use-user-context";

export function VentureBadge({
  ventureId,
  ventures,
}: {
  ventureId: string;
  ventures?: Array<{ id: string; name: string }>;
}) {
  const ctx = useOptionalUserContext();
  // Hidden if single venture
  if (ctx?.isSingleVenture) return null;

  const allVentures = ventures ?? ctx?.ventures ?? [];
  const venture = allVentures.find((v) => v.id === ventureId);
  if (!venture) return null;

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-moss/10 text-moss">
      {venture.name}
    </span>
  );
}
