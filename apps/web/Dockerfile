# CompanyBrain dashboard image. Built from the repo root context.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the whole workspace (host node_modules etc. excluded via .dockerignore)
# so pnpm sees the workspace root and `--filter` resolves.
COPY . .
RUN pnpm install --filter @companybrain/web...
RUN pnpm --filter @companybrain/web build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# Next.js standalone output bundles a minimal server + only the deps it needs.
# For a monorepo it mirrors the workspace layout under `standalone/`.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
