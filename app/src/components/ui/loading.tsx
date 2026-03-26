const LOADING_CAPTIONS: Record<string, string> = {
  bets: "Assembling the war council...",
  ideas: "Checking quarantine status...",
  pulse: "Calibrating the heartbeat...",
  scoreboard: "Crunching the numbers that matter...",
  graveyard: "Dusting off the tombstones...",
  cockpit: "Warming up the cockpit...",
};

export function LoadingSpinner({ className = "", context }: { className?: string; context?: string }) {
  const caption = context ? LOADING_CAPTIONS[context] : undefined;
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      {caption && (
        <p className="font-mono text-[10px] text-faded">{caption}</p>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-well/50 flex items-center justify-center mb-4 text-faded">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-subtle max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retry,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-medium text-semantic-brick">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-subtle">{description}</p>
      )}
      {retry && (
        <button
          onClick={retry}
          className="mt-4 text-sm font-medium text-accent hover:text-accent-warm"
        >
          Try again
        </button>
      )}
    </div>
  );
}
