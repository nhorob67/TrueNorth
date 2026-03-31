interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-lg ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-surface border border-line rounded-[10px] p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonText lines={2} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** KPI tile skeleton matching scoreboard grid */
export function SkeletonKpiTile({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-surface border border-line rounded-[10px] p-5 space-y-3 ${className}`}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12 rounded-[4px]" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/** Dashboard grid skeleton — KPI cards + section */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonKpiTile key={i} />
        ))}
      </div>
      {/* Cards section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/** Table row skeleton for list views */
export function SkeletonTableRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface border border-line rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-line bg-well/30">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3 border-b border-line last:border-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-16 rounded-[4px]" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12 ml-auto rounded-[4px]" />
        </div>
      ))}
    </div>
  );
}
