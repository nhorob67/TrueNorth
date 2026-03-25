export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-subtle">{description}</p>
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
