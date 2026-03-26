import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  borderColor?: string;
  interactive?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function Card({ borderColor, interactive = false, className = "", style, children, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={`bg-surface border border-line rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200 ${interactive ? "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:translate-y-[-1px] cursor-pointer" : ""} ${className}`}
      style={{
        ...style,
        ...(borderColor ? { borderLeftWidth: "4px", borderLeftColor: borderColor } : {}),
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 py-4 border-b border-line ${className}`} {...props} />;
}

export function CardContent({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 py-4 ${className}`} {...props} />;
}

export function CardFooter({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-t border-line ${className}`} {...props} />
  );
}
