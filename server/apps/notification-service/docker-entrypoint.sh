#!/bin/sh
set -eu

SCHEMA="apps/notification-service/prisma/schema.prisma"
attempt=0

echo "Running migrations for notification-service..."
until ./node_modules/.bin/prisma migrate deploy --schema "$SCHEMA"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Migrations failed for $SCHEMA" >&2
    exit 1
  fi
  echo "Database not ready yet, retrying in 2s ($attempt/30)..."
  sleep 2
done

echo "Starting notification-service on port ${PORT:-4004}..."
exec node "dist/apps/notification-service/src/server.js"

