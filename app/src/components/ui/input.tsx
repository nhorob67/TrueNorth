import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ label, error, className = "", id, ref, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-charcoal"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm text-charcoal placeholder:text-warm-gray focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20 disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-semantic-brick focus:border-semantic-brick focus:ring-semantic-brick/20" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-semantic-brick">{error}</p>}
    </div>
  );
}
