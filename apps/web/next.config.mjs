import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Pin file tracing to the monorepo root so the standalone output layout is
  // deterministic (`.next/standalone/apps/web/server.js`), matching the Dockerfile.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // The dashboard talks to the API directly from the browser (credentials + CORS).
  // NEXT_PUBLIC_API_URL points at the CompanyBrain API.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  },
};

export default nextConfig;
