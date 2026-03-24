import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  borderColor?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function Card({ borderColor, className = "", style, children, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={`bg-ivory border border-warm-border rounded-lg shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
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
  return <div className={`px-6 py-4 border-b border-warm-border ${className}`} {...props} />;
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
    <div className={`px-6 py-4 border-t border-warm-border ${className}`} {...props} />
  );
}
