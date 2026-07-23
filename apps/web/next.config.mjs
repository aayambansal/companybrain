/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // The dashboard talks to the API directly from the browser (credentials + CORS).
  // NEXT_PUBLIC_API_URL points at the CompanyBrain API.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333',
  },
};

export default nextConfig;
