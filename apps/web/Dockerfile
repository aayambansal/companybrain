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
# For a monorepo it mirrors the workspace layout under `standalone/`. Copy with
# `node` ownership so the container can run as the built-in non-root user.
COPY --chown=node:node --from=builder /app/apps/web/.next/standalone ./
COPY --chown=node:node --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node --from=builder /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "apps/web/server.js"]
