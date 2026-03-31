import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Strategy
      { source: "/vision", destination: "/strategy/vision", permanent: true },
      { source: "/scoreboard", destination: "/strategy/scoreboard", permanent: true },
      { source: "/scoreboard/:path*", destination: "/strategy/scoreboard/:path*", permanent: true },
      { source: "/portfolio", destination: "/strategy/portfolio", permanent: true },
      { source: "/launch", destination: "/strategy/launch", permanent: true },

      // Execution
      { source: "/bets", destination: "/execution/bets", permanent: true },
      { source: "/bets/:path*", destination: "/execution/bets/:path*", permanent: true },
      { source: "/ideas", destination: "/execution/ideas", permanent: true },
      { source: "/content", destination: "/execution/content", permanent: true },
      { source: "/content/:path*", destination: "/execution/content/:path*", permanent: true },
      { source: "/funnels", destination: "/execution/funnels", permanent: true },

      // Reviews
      { source: "/sync", destination: "/reviews/sync", permanent: true },
      { source: "/sync/:path*", destination: "/reviews/sync/:path*", permanent: true },
      { source: "/ops", destination: "/reviews/operations", permanent: true },
      { source: "/health", destination: "/reviews/health", permanent: true },
      { source: "/narratives", destination: "/reviews/narratives", permanent: true },
      { source: "/pulse", destination: "/reviews/pulse", permanent: true },

      // Library
      { source: "/processes", destination: "/library/processes", permanent: true },
      { source: "/processes/:path*", destination: "/library/processes/:path*", permanent: true },
      { source: "/artifacts", destination: "/library/artifacts", permanent: true },

      // Admin
      { source: "/settings", destination: "/admin/settings", permanent: true },
      { source: "/settings/:path*", destination: "/admin/settings/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
