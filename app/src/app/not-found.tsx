import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-parchment gap-4">
      <h1 className="text-4xl font-bold text-charcoal">404</h1>
      <p className="text-warm-gray">This page could not be found.</p>
      <Link
        href="/cockpit"
        className="text-sm font-medium text-clay-text hover:text-clay-text/80"
      >
        Back to Cockpit
      </Link>
    </div>
  );
}
