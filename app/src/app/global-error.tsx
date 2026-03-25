"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-semantic-brick">
            Something went wrong
          </h2>
          <p className="text-sm text-subtle">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-white bg-cta rounded-lg hover:bg-cta-hover"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
