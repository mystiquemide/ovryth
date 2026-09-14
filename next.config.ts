import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev tunnel host to load HMR resources during local review.
  allowedDevOrigins: ["easily-synergy-canopener.ngrok-free.dev"],
};

export default nextConfig;
