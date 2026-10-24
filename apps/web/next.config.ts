import path from 'node:path';
import type { NextConfig } from 'next';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const monorepoRoot = path.join(__dirname, '..', '..');

const nextConfig: NextConfig = {
  // @tgh/shared ships as TypeScript source.
  transpilePackages: ['@tgh/shared'],
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (apps/web/Dockerfile).
  output: 'standalone',

  // The browser only ever talks to this origin; auth cookies stay first-party.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` }];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Browsers must always see the latest worker, or a fix never reaches installed copies.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
