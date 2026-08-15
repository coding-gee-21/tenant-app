import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: {
    position: "bottom-left",
  },
  allowedDevOrigins: [
    "192.168.10.1",
    "192.168.10.3:3000",
    "localhost:3000",
  ],
};

export default nextConfig;