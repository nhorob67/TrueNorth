import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-canvas gap-4">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">404</h1>
      <p className="text-subtle">This page could not be found.</p>
      <Link
        href="/"
        className="text-sm font-medium text-accent hover:text-accent/80"
      >
        Back to Cockpit
      </Link>
    </div>
  );
}
