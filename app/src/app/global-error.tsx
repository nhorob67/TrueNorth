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
      <body className="bg-parchment">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="text-lg font-semibold text-semantic-brick">
            Something went wrong
          </h2>
          <p className="text-sm text-warm-gray">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-white bg-clay rounded-lg hover:bg-clay/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
