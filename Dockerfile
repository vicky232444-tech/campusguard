FROM oven/bun:debian

WORKDIR /app

# Install curl, ca-certificates, and tar to fetch static Caddy
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

# Download official static Caddy binary
RUN curl -sSL "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_amd64.tar.gz" | tar -xz -C /usr/local/bin caddy && chmod +x /usr/local/bin/caddy

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:../db/custom.db"
ENV INTERNAL_SECRET="campusguard-demo-secret"
ENV PORT=10000

# Copy all source files
COPY . .

# Install dependencies (includes devDependencies for Next build)
RUN bun install

# Generate Prisma Client
RUN bun x prisma generate

# Install sim-service dependencies
RUN cd mini-services/sim-service && bun install

# Build Next.js application
ENV NODE_ENV=production
RUN bun run build

# Copy static assets to standalone directory
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ || true
RUN cp -r public .next/standalone/ || true

# Ensure start script has LF line endings and execute permissions
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh && chmod -R 777 ./db

EXPOSE 10000

CMD ["./start.sh"]
