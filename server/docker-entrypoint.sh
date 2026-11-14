#!/bin/sh
set -eu

if [ -z "${SERVICE_NAME:-}" ]; then
  echo "SERVICE_NAME is required" >&2
  exit 1
fi

if [ -n "${PRISMA_SCHEMA:-}" ]; then
  attempt=0
  until ./node_modules/.bin/prisma migrate deploy --schema "$PRISMA_SCHEMA"; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "migrations failed for $PRISMA_SCHEMA" >&2
      exit 1
    fi
    sleep 2
  done
fi

if [ "${RUN_SEED:-}" = "true" ]; then
  node dist/scripts/seed.js
fi

exec node "dist/apps/${SERVICE_NAME}/src/server.js"
