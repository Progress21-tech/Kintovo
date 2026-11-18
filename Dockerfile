# Kintovo production image (Next.js standalone server + Prisma migrations).
# Build:  docker build -t kintovo .
# Run:    see docker-compose.yml, or pass DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_URL.
FROM node:22.18-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma generate needs a syntactically valid URL; no database is contacted during the build.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" DIRECT_URL="postgresql://build:build@localhost:5432/build" npm run build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 PRIVATE_UPLOAD_DIR=/data/private-uploads
RUN groupadd --system kintovo && useradd --system --gid kintovo --home /app kintovo \
  && mkdir -p /data/private-uploads && chown -R kintovo:kintovo /data
COPY --from=build --chown=kintovo:kintovo /app/.next ./.next
COPY --from=build --chown=kintovo:kintovo /app/public ./public
COPY --from=build --chown=kintovo:kintovo /app/node_modules ./node_modules
COPY --from=build --chown=kintovo:kintovo /app/package.json /app/next.config.ts /app/prisma.config.ts ./
COPY --from=build --chown=kintovo:kintovo /app/prisma ./prisma
COPY --from=build --chown=kintovo:kintovo /app/src/generated ./src/generated
USER kintovo
VOLUME ["/data/private-uploads"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply committed migrations, then start. Never runs the demo seed.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start"]
