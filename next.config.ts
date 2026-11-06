import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare tunnels, localtunnel, ngrok, and local LAN devices
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "**.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "192.168.29.20",
    "192.168.*.*",
    "10.*.*.*",
  ],

  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.trycloudflare.com",
        "**.trycloudflare.com",
        "*.loca.lt",
        "*.ngrok-free.app",
        "*.ngrok.io",
      ],
    },
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
