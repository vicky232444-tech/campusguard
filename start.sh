#!/bin/bash
set -e

RENDER_PORT=${PORT:-10000}
echo "============================================="
echo "   CampusGuard — Production Service Startup   "
echo "   External Render Port: $RENDER_PORT"
echo "============================================="

# Ensure db directory exists and has full write permissions
mkdir -p db
chmod -R 777 db

# 1. Start sim-service in background on port 3003
if [ -d "mini-services/sim-service" ]; then
    echo "[start.sh] Starting simulation service on port 3003..."
    (cd mini-services/sim-service && bun index.ts) &
fi

# 2. Start Next.js standalone on internal port 3000
echo "[start.sh] Starting Next.js standalone server on internal port 3000..."
(PORT=3000 bun server.js) &

# 3. Wait briefly for internal services to spin up
sleep 2

# 4. Start Caddy in foreground on Render's external port
export PORT=$RENDER_PORT
echo "[start.sh] Starting Caddy reverse proxy on external port $PORT..."
exec caddy run --config Caddyfile --adapter caddyfile
