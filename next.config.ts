import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.5"],
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "jsonwebtoken",
  ],
};

export default nextConfig;
