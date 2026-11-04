import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mozilla/readability", "rss-parser", "linkedom"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
