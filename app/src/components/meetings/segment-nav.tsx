"use client";

export interface SegmentConfig<K extends string = string> {
  key: K;
  label: string;
  duration: number;
  description: string;
}

interface SegmentNavProps<K extends string> {
  segments: SegmentConfig<K>[];
  activeSegment: K;
  onSelect: (key: K) => void;
  segmentTimeUsed: Record<K, number>;
}

export function SegmentNav<K extends string>({
  segments,
  activeSegment,
  onSelect,
  segmentTimeUsed,
}: SegmentNavProps<K>) {
  return (
    <div className="flex gap-1 mb-6 flex-wrap">
      {segments.map((seg) => {
        const isActive = activeSegment === seg.key;
        const timeUsed = segmentTimeUsed[seg.key] ?? 0;
        const overTime = timeUsed > seg.duration * 60;

        return (
          <button
            key={seg.key}
            onClick={() => onSelect(seg.key)}
            className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              isActive
                ? "bg-accent text-white border-accent"
                : "text-subtle hover:text-ink border-line"
            }`}
          >
            <div className="truncate">{seg.label}</div>
            <div
              className={`text-xs mt-0.5 ${
                isActive
                  ? "text-white/70"
                  : overTime
                    ? "text-semantic-brick"
                    : "text-subtle"
              }`}
            >
              {seg.duration} min
            </div>
          </button>
        );
      })}
    </div>
  );
}
