#!/usr/bin/env bash
# Package the CampusGuard project into a clean, portable zip for download.
# Excludes: dependencies (node_modules), build output (.next), sandbox-only
# folders, logs, and internal worklogs. Includes the seeded SQLite database.
set -euo pipefail

ROOT=/home/z/my-project
STAGE="$ROOT/.ztmp_zip"
OUT="$ROOT/download/CampusGuard-TechTrix26.zip"

cd "$ROOT"
rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE/CampusGuard"

tar cf - \
  --exclude='./node_modules' \
  --exclude='*node_modules' \
  --exclude='./.next' \
  --exclude='./download' \
  --exclude='./.zscripts' \
  --exclude='./tests' \
  --exclude='./examples' \
  --exclude='./.ztmp_zip' \
  --exclude='./worklog.md' \
  --exclude='*.log' \
  --exclude='.eslintcache' \
  --exclude='*.tsbuildinfo' \
  --exclude='./nohup.out' \
  --exclude='./skills' \
  --exclude='./.git' \
  --exclude='./upload' \
  . | tar xf - -C "$STAGE/CampusGuard"

# Portable .env for the extracted project.
# Prisma resolves relative SQLite paths against prisma/schema.prisma,
# so ../db/custom.db points to <project>/db/custom.db (seeded, included).
printf 'DATABASE_URL=file:../db/custom.db\n' > "$STAGE/CampusGuard/.env"

cd "$STAGE"
zip -rq "$OUT" CampusGuard
cd "$ROOT"
rm -rf "$STAGE"

echo "Created: $OUT"
du -sh "$OUT"
