# CompanyBrain API image. Built from the repo root context.
# Runs TypeScript directly with tsx (no cross-package build step).
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS runner
ENV NODE_ENV=production
# Copy the whole workspace (host node_modules etc. excluded via .dockerignore)
# so pnpm sees the full workspace root and can resolve @companybrain/* deps.
COPY . .
RUN pnpm install --filter @companybrain/api...
EXPOSE 3333
CMD ["pnpm", "--filter", "@companybrain/api", "exec", "tsx", "src/index.ts"]
