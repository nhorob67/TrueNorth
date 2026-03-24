import { HTMLAttributes } from "react";

type BadgeStatus = "green" | "yellow" | "red" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
  dot?: boolean;
}

const statusStyles: Record<BadgeStatus, string> = {
  green: "bg-semantic-green/10 text-semantic-green-text",
  yellow: "bg-semantic-ochre/10 text-semantic-ochre-text",
  red: "bg-semantic-brick/10 text-semantic-brick",
  neutral: "bg-warm-gray/10 text-warm-gray",
};

const dotColors: Record<BadgeStatus, string> = {
  green: "bg-semantic-green",
  yellow: "bg-semantic-ochre",
  red: "bg-semantic-brick",
  neutral: "bg-warm-gray",
};

export function Badge({
  status,
  dot = true,
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status]}`} />
      )}
      {children}
    </span>
  );
}
