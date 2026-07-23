export interface ApiEnv {
  host: string;
  port: number;
  jwtSecret: string;
  corsOrigins: string[];
  version: string;
}

export function loadApiEnv(): ApiEnv {
  const corsRaw = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
  return {
    host: process.env.API_HOST ?? '0.0.0.0',
    port: Number.parseInt(process.env.API_PORT ?? '3333', 10),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    corsOrigins: corsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    version: process.env.COMPANYBRAIN_VERSION ?? '0.1.0',
  };
}
