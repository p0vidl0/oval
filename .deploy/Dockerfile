# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
# Production image for VPS (build context: repo root).

ARG PNPM_VERSION=12.9.1

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS deps
ARG PNPM_VERSION
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# prepare (`lefthook install`) нужен git-репозиторий; в образе хуков нет.
RUN npm pkg delete scripts.prepare && pnpm install --frozen-lockfile

FROM deps AS builder
ARG GIT_COMMIT=unknown
ARG SERVER_ACTION_BODY_SIZE_LIMIT
ENV GIT_COMMIT=${GIT_COMMIT}
ENV SERVER_ACTION_BODY_SIZE_LIMIT=${SERVER_ACTION_BODY_SIZE_LIMIT}
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runner
ARG GIT_COMMIT=unknown

WORKDIR /app

ENV GIT_COMMIT=${GIT_COMMIT}
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Next.js standalone (traced server + minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Drizzle migrate — отдельный mini node_modules (без devDeps всего приложения)
WORKDIR /app/migrate
COPY .deploy/migrate-package.json ./package.json
RUN npm install --omit=dev --no-package-lock
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/lib/db/schema ./lib/db/schema
COPY --from=builder /app/tsconfig.json ./tsconfig.json

WORKDIR /app
COPY .deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
