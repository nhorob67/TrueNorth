interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  status?: "green" | "yellow" | "red";
  strokeWidth?: number;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  green: "var(--color-semantic-green)",
  yellow: "var(--color-semantic-ochre)",
  red: "var(--color-semantic-brick)",
};

export function MiniSparkline({
  data,
  width = 80,
  height = 24,
  color,
  status,
  strokeWidth = 1.5,
  className = "",
}: MiniSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor = color ?? (status ? statusColorMap[status] : "currentColor");

  return (
    <svg width={width} height={height} className={`flex-shrink-0 ${className}`}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
