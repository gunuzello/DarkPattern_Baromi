FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm ci \
    && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate:all \
    && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

FROM build AS api
ENV NODE_ENV=production
RUN npm prune --omit=dev --ignore-scripts
USER node
EXPOSE 8080
CMD ["sh", "-c", "exec ./node_modules/.bin/next start --hostname 0.0.0.0 --port \"${PORT:-8080}\""]

FROM build AS worker
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright SCAN_RESULTS_DIR=/tmp/baromi-scan-results
RUN npm prune --omit=dev --ignore-scripts
USER root
RUN ./node_modules/.bin/playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
USER node
ENTRYPOINT ["./node_modules/.bin/tsx", "scripts/cloud-run-job.ts"]

FROM build AS migrate
ENV NODE_ENV=production
USER node
ENTRYPOINT ["./node_modules/.bin/prisma"]

FROM api AS default
