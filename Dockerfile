# Stage 1: Official Caddy binary
FROM caddy:alpine AS caddy-bin

# Stage 2: Build Next.js & Dependencies
FROM oven/bun:debian AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:../db/custom.db"

# Copy package manifests
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Install root dependencies
RUN bun install

# Generate Prisma Client
RUN bun x prisma generate

# Copy source code and database
COPY . .

# Build Next.js standalone output
ENV NODE_ENV=production
RUN bun run build

# Prepare standalone static and public assets
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ || true
RUN cp -r public .next/standalone/ || true

# Stage 3: Minimal Production Image
FROM oven/bun:debian AS runner
WORKDIR /app

# Copy Caddy binary
COPY --from=caddy-bin /usr/bin/caddy /usr/local/bin/caddy

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV DATABASE_URL="file:../db/custom.db"
ENV INTERNAL_SECRET="campusguard-demo-secret"

# Copy Next.js standalone bundle
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db
COPY --from=builder /app/Caddyfile ./Caddyfile
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/start.sh ./start.sh

# Ensure execute permissions and SQLite writeability
RUN chmod +x ./start.sh && chmod -R 777 ./db

EXPOSE 10000

CMD ["./start.sh"]
