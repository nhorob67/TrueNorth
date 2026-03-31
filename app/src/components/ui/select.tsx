import { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  ref?: React.Ref<HTMLSelectElement>;
}

export function Select({ label, error, className = "", id, children, ref, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className={`block w-full rounded-[var(--radius-md)] border border-line bg-well px-3 py-2.5 min-h-[44px] text-sm text-ink focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-semantic-brick focus:border-semantic-brick focus:ring-semantic-brick/20" : ""} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p id={id ? `${id}-error` : undefined} className="text-xs text-semantic-brick">{error}</p>}
    </div>
  );
}
