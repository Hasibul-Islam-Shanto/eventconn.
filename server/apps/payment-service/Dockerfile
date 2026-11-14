# Payment Service - Dockerfile
# Stage 1: Build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY packages ./packages
COPY apps/payment-service ./apps/payment-service

RUN npm ci \
  && npx prisma generate --schema apps/payment-service/prisma/schema.prisma \
  && npx tsc -p tsconfig.build.json \
  && mkdir -p dist/apps/payment-service/generated \
  && cp -r apps/payment-service/generated dist/apps/payment-service/

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4005

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/packages ./dist/packages
COPY --from=builder /app/dist/apps/payment-service ./dist/apps/payment-service
COPY --from=builder /app/apps/payment-service/prisma ./apps/payment-service/prisma
COPY --from=builder /app/apps/payment-service/generated ./apps/payment-service/generated

COPY apps/payment-service/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4005

HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:4005/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]

