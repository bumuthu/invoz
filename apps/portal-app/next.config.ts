import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@invoz/common", "@invoz/database"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    return [
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/i,
      resourceQuery: /url/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
