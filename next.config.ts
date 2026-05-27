import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `public/` (~250 MB de sprites/mapas) se sirve por CDN en Vercel y no debe
   * copiarse dentro de cada Serverless Function (límite 250 MB descomprimido).
   */
  outputFileTracingExcludes: {
    "*": ["./public/**/*"],
  },
  images: {
    /** Assets de juego ya en PNG/WebP en `public/`; evita empaquetar `sharp` en funciones. */
    unoptimized: true,
  },
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
