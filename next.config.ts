import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vendor inventory CSVs can be a few MB; the default 1 MB cap on
    // Server Action bodies trips the uploadInventory action.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
