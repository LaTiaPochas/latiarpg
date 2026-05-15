import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Compat: enlaces viejos o datos con typo `bakground` → carpeta real `background`. */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/img/resources/bakground/:path*",
          destination: "/img/resources/background/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
