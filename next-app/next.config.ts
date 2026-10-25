import type { NextConfig } from "next";
import { env } from "./src/config/env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,

  cacheLife: {
    // Legacy content changes rarely: serve cached data, refresh it in the background
    // every minute, and keep serving the last good copy for up to an hour if legacy is down.
    articles: {
      stale: 60,
      revalidate: 60,
      expire: 3600,
    },
  },

  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Applied only when no Next.js page or asset matches: the rest of the legacy site
      // keeps working under its original URLs (query strings are passed through).
      fallback: [
        {
          source: "/:path*",
          destination: `${env.LEGACY_ORIGIN}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
