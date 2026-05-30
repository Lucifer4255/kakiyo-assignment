import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@better-auth/kysely-adapter", "@better-auth/infra", "kysely"],
};

export default nextConfig;
