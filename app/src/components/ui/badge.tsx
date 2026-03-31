import { HTMLAttributes } from "react";

type BadgeStatus = "green" | "yellow" | "red" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
  dot?: boolean;
  /** Show a shape icon instead of dot for colorblind accessibility */
  iconIndicator?: boolean;
}

const statusStyles: Record<BadgeStatus, string> = {
  green: "bg-semantic-green/10 text-semantic-green-text",
  yellow: "bg-semantic-ochre/10 text-semantic-ochre-text",
  red: "bg-semantic-brick/10 text-semantic-brick",
  neutral: "bg-faded/10 text-subtle",
};

const dotColors: Record<BadgeStatus, string> = {
  green: "bg-semantic-green",
  yellow: "bg-semantic-ochre",
  red: "bg-semantic-brick",
  neutral: "bg-faded",
};

const statusIcons: Record<BadgeStatus, React.ReactNode> = {
  green: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  yellow: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
  ),
  red: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
    </svg>
  ),
  neutral: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  ),
};

const statusAriaLabels: Record<BadgeStatus, string> = {
  green: "On track",
  yellow: "At risk",
  red: "Critical",
  neutral: "Neutral",
};

export function Badge({
  status,
  dot = true,
  iconIndicator = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-sm)] font-mono text-[10.5px] font-semibold tracking-[0.04em] ${statusStyles[status]} ${className}`}
      aria-label={!children ? statusAriaLabels[status] : undefined}
      {...props}
    >
      {iconIndicator ? (
        statusIcons[status]
      ) : dot ? (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status]}`} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
