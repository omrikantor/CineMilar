import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-only "N" route/rendering badge. It never appears in
  // production; compile and runtime errors are still shown in development.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
};

export default nextConfig;
