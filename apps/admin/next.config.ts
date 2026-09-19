import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace package shipped as TypeScript source.
  transpilePackages: ["@repo/queue"],
  // Keep ioredis as a real Node dependency on the server (not bundled).
  serverExternalPackages: ["ioredis"],
};

export default nextConfig;
