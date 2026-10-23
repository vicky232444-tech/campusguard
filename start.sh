#!/bin/sh
set -e

RENDER_PORT="${PORT:-10000}"
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

# 2. Start Next.js standalone on internal port 3000 with explicit HOSTNAME
echo "[start.sh] Starting Next.js server on internal port 3000..."
(HOSTNAME="0.0.0.0" PORT=3000 bun .next/standalone/server.js) &

# 3. Wait until Next.js is responding on port 3000
echo "[start.sh] Waiting for Next.js to be ready on internal port 3000..."
i=1
while [ $i -le 30 ]; do
    if curl -s -f http://127.0.0.1:3000/api > /dev/null 2>&1; then
        echo "[start.sh] Next.js is ready after ${i}s!"
        break
    fi
    sleep 1
    i=$((i + 1))
done

# 4. Start Caddy in foreground on Render external port
export PORT="$RENDER_PORT"
echo "[start.sh] Starting Caddy reverse proxy on external port $PORT..."
exec caddy run --config Caddyfile --adapter caddyfile
