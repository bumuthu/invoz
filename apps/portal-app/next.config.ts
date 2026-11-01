import type { NextConfig } from "next";

const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "PORTAL_REQUIRE_ORG_HOST",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

const env = Object.fromEntries(
  names.flatMap((name) => {
    const value = process.env[name];
    return value ? [[name, value]] : [];
  }),
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env,
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
