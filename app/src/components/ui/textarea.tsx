import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, error, className = "", id, ref, ...props }: TextareaProps) {
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
      <textarea
        ref={ref}
        id={id}
        className={`block w-full rounded-lg border border-warm-border bg-ivory px-3 py-2 text-sm text-charcoal placeholder:text-warm-gray focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20 disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-semantic-brick focus:border-semantic-brick focus:ring-semantic-brick/20" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-semantic-brick">{error}</p>}
    </div>
  );
}
