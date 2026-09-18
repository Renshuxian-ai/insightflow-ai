import type { NextConfig } from "next";

const isCloudBaseBuild = process.env.CLOUDBASE_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isCloudBaseBuild ? { output: "standalone" as const } : {}),
};

export default nextConfig;
