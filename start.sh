#!/bin/bash
set -e

echo "============================================="
echo "   CampusGuard — Production Service Startup   "
echo "============================================="

# Ensure db directory exists and has full write permissions
mkdir -p db
chmod -R 777 db

# Start sim-service in background
if [ -d "mini-services/sim-service" ]; then
    echo "[start.sh] Starting simulation service on port 3003..."
    (cd mini-services/sim-service && bun index.ts) &
fi

# Start Next.js standalone on port 3000
echo "[start.sh] Starting Next.js standalone server on port 3000..."
PORT=3000 bun server.js &

# Wait briefly for internal services to bind
sleep 2

# Start Caddy in foreground on Render's $PORT (default 10000)
echo "[start.sh] Starting Caddy reverse proxy on port ${PORT:-10000}..."
exec caddy run --config Caddyfile --adapter caddyfile
