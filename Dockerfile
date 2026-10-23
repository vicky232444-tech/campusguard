# Stage 1: Official Caddy binary
FROM caddy:2-alpine AS caddy-bin

# Stage 2: Build Next.js & Dependencies
FROM oven/bun:1.2-debian AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copy package manifests
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Install root dependencies
RUN bun install

# Generate Prisma Client
RUN bun x prisma generate

# Copy source code
COPY . .

# Build Next.js standalone output
RUN bun run build

# Install sim-service dependencies
WORKDIR /app/mini-services/sim-service
RUN bun install
WORKDIR /app

# Stage 3: Minimal Production Image
FROM oven/bun:1.2-debian AS runner
WORKDIR /app

# Copy Caddy binary
COPY --from=caddy-bin /usr/bin/caddy /usr/local/bin/caddy

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV DATABASE_URL=file:../db/custom.db
ENV INTERNAL_SECRET=campusguard-demo-secret

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
