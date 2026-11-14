# Booking Service - Dockerfile
# Stage 1: Build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY packages ./packages
COPY apps/booking-service ./apps/booking-service

RUN npm ci \
  && npx prisma generate --schema apps/booking-service/prisma/schema.prisma \
  && npx tsc -p tsconfig.build.json \
  && mkdir -p dist/apps/booking-service/generated \
  && cp -r apps/booking-service/generated dist/apps/booking-service/

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4003

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/packages ./dist/packages
COPY --from=builder /app/dist/apps/booking-service ./dist/apps/booking-service
COPY --from=builder /app/apps/booking-service/prisma ./apps/booking-service/prisma
COPY --from=builder /app/apps/booking-service/generated ./apps/booking-service/generated

COPY apps/booking-service/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4003

HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:4003/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]

