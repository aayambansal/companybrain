# CompanyBrain API image. Built from the repo root context.
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Install workspace deps (cached on lockfile + manifests).
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @companybrain/api...

# Runtime: copy sources and run TypeScript directly with tsx.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/core ./packages/core
COPY apps/api ./apps/api
EXPOSE 3333
CMD ["pnpm", "--filter", "@companybrain/api", "exec", "tsx", "src/index.ts"]
