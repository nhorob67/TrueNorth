import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-cta text-cta-text hover:bg-cta-hover active:scale-[0.98] focus-visible:ring-accent/50 shadow-[0_2px_8px_rgba(183,78,40,0.18)] hover:shadow-[0_4px_20px_rgba(183,78,40,0.28)]",
  secondary:
    "bg-surface text-ink border border-line hover:bg-well active:scale-[0.98] focus-visible:ring-line/50",
  tertiary:
    "bg-transparent text-accent hover:bg-accent-dim active:scale-[0.98] focus-visible:ring-accent/50",
  destructive:
    "bg-semantic-brick text-white hover:bg-semantic-brick/90 active:scale-[0.98] focus-visible:ring-semantic-brick/50",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-[6px]",
  md: "px-4 py-2 text-sm rounded-[8px]",
  lg: "px-6 py-3 text-base rounded-[8px]",
};

export function Button({ variant = "primary", size = "md", loading = false, className = "", ref, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:duration-75 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
