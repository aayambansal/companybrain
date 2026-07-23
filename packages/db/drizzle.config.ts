import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://companybrain:companybrain@localhost:5432/companybrain',
  },
  verbose: true,
  strict: true,
});
