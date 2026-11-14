# Notification Service - Dockerfile
# Stage 1: Build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY packages ./packages
COPY apps/notification-service ./apps/notification-service

RUN npm ci \
  && npx prisma generate --schema apps/notification-service/prisma/schema.prisma \
  && npx tsc -p tsconfig.build.json \
  && mkdir -p dist/apps/notification-service/generated \
  && cp -r apps/notification-service/generated dist/apps/notification-service/

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4004

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/packages ./dist/packages
COPY --from=builder /app/dist/apps/notification-service ./dist/apps/notification-service
COPY --from=builder /app/apps/notification-service/prisma ./apps/notification-service/prisma
COPY --from=builder /app/apps/notification-service/generated ./apps/notification-service/generated

COPY apps/notification-service/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4004

HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:4004/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]

