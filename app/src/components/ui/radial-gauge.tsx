interface RadialGaugeProps {
  value: number; // 0-100
  label?: string;
  size?: number; // default 48
  strokeWidth?: number; // default 4
  className?: string;
}

export function RadialGauge({
  value,
  label,
  size = 48,
  strokeWidth = 4,
  className = "",
}: RadialGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color =
    value > 66
      ? "var(--color-semantic-green)"
      : value >= 33
        ? "var(--color-semantic-ochre)"
        : "var(--color-semantic-brick)";

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 0.6s var(--easing-default)",
            }}
          />
        </svg>
        {/* Value text centered over the circle */}
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold"
          style={{ color }}
        >
          {value}
        </span>
      </div>
      {label && (
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-faded">
          {label}
        </span>
      )}
    </div>
  );
}
