# Staging / production images only (local development uses no Docker — see CLAUDE.md).
# docker build --target api|worker|web .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM build AS api
ENV NODE_ENV=production
EXPOSE 4010
# migrations are applied by the release job: `pnpm --filter @djaber/db migrate:deploy`
CMD ["node", "apps/api/dist/main.js"]

FROM build AS worker
ENV NODE_ENV=production
CMD ["node", "apps/worker/main.js"]

FROM build AS web
ENV NODE_ENV=production
EXPOSE 3010
CMD ["pnpm", "--filter", "@djaber/web", "start"]
