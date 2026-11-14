#!/bin/sh
set -eu

SCHEMA="apps/auth-service/prisma/schema.prisma"
attempt=0

echo "Running migrations for auth-service..."
until ./node_modules/.bin/prisma migrate deploy --schema "$SCHEMA"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Migrations failed for $SCHEMA" >&2
    exit 1
  fi
  echo "Database not ready yet, retrying in 2s ($attempt/30)..."
  sleep 2
done

echo "Starting auth-service on port ${PORT:-4001}..."
exec node "dist/apps/auth-service/src/server.js"

