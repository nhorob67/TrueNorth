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
          className="block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={`block w-full rounded-[8px] border border-line bg-well px-3 py-2 text-sm text-ink placeholder:text-faded focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-semantic-brick focus:border-semantic-brick focus:ring-semantic-brick/20" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-semantic-brick">{error}</p>}
    </div>
  );
}
