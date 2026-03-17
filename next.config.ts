import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Firebase vendor-chunk 경로 이슈 회피 (Next.js 15) */
  serverExternalPackages: ["firebase", "firebase-admin"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
