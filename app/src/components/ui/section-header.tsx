interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ label, title, action, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        {label && (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.10em] text-faded mb-1">
            {label}
          </p>
        )}
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
