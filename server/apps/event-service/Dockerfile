# Event Service - Dockerfile
# Stage 1: Build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY packages ./packages
COPY apps/auth-service/prisma ./apps/auth-service/prisma
COPY apps/booking-service/prisma ./apps/booking-service/prisma
COPY apps/event-service ./apps/event-service
COPY scripts ./scripts

RUN npm ci \
  && npx prisma generate --schema apps/auth-service/prisma/schema.prisma \
  && npx prisma generate --schema apps/event-service/prisma/schema.prisma \
  && npx prisma generate --schema apps/booking-service/prisma/schema.prisma \
  && npx tsc -p tsconfig.build.json \
  && mkdir -p dist/apps/event-service/generated dist/apps/auth-service/generated dist/apps/booking-service/generated \
  && cp -r apps/event-service/generated dist/apps/event-service/ \
  && cp -r apps/auth-service/generated dist/apps/auth-service/ \
  && cp -r apps/booking-service/generated dist/apps/booking-service/

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4002

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/packages ./dist/packages
COPY --from=builder /app/dist/apps/event-service ./dist/apps/event-service
COPY --from=builder /app/dist/scripts ./dist/scripts
COPY --from=builder /app/apps/event-service/prisma ./apps/event-service/prisma
COPY --from=builder /app/apps/event-service/generated ./apps/event-service/generated
COPY --from=builder /app/apps/auth-service/generated ./apps/auth-service/generated
COPY --from=builder /app/apps/booking-service/generated ./apps/booking-service/generated

COPY apps/event-service/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4002

HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:4002/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
