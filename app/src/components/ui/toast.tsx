"use client";

import { useToast } from "@/hooks/use-toast";

const variantStyles: Record<string, { border: string; icon: React.ReactNode }> = {
  success: {
    border: "border-l-semantic-green",
    icon: (
      <svg className="w-4 h-4 text-semantic-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  error: {
    border: "border-l-semantic-brick",
    icon: (
      <svg className="w-4 h-4 text-semantic-brick" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
  info: {
    border: "border-l-accent",
    icon: (
      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  },
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
    >
      {toasts.map((toast) => {
        const style = variantStyles[toast.variant] ?? variantStyles.info;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 bg-surface border border-line ${style.border} border-l-4 rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] animate-slide-in-right`}
          >
            <span className="flex-shrink-0 mt-0.5">{style.icon}</span>
            <p className="flex-1 text-sm text-ink">{toast.message}</p>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  dismissToast(toast.id);
                }}
                className="flex-shrink-0 text-xs font-semibold text-accent hover:text-accent-warm transition-colors"
              >
                Undo
              </button>
            )}
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 text-faded hover:text-subtle transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
