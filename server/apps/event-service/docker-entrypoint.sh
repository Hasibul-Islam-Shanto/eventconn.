#!/bin/sh
set -eu

SCHEMA="apps/event-service/prisma/schema.prisma"
attempt=0

echo "Running migrations for event-service..."
until ./node_modules/.bin/prisma migrate deploy --schema "$SCHEMA"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Migrations failed for $SCHEMA" >&2
    exit 1
  fi
  echo "Database not ready yet, retrying in 2s ($attempt/30)..."
  sleep 2
done

if [ "${RUN_SEED:-}" = "true" ] && [ -f "dist/scripts/seed.js" ]; then
  echo "Seeding initial event categories..."
  node dist/scripts/seed.js || echo "Seeding completed or already present"
fi

echo "Starting event-service on port ${PORT:-4002}..."
exec node "dist/apps/event-service/src/server.js"

