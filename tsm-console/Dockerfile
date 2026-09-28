# TSM production runtime image
#
# Build context is the repository root (see tsm-console/docker-compose.yml):
# the Vite build statically imports repo-root data (data/scenarios,
# data/schemas, artifacts/), which a tsm-console-only context cannot see.
# The build stage mirrors the repo layout under /app so those relative
# imports (e.g. ../../../../data/scenarios/... from tsm-console/src/...)
# resolve exactly as they do in a full checkout.
FROM node:22-alpine AS build
WORKDIR /app/tsm-console
COPY tsm-console/package.json tsm-console/package-lock.json ./
COPY tsm-console/scripts/postinstall-check.mjs ./scripts/postinstall-check.mjs
COPY tsm-console/vite.config.ts tsm-console/index.html ./
COPY tsm-console/src/main.tsx ./src/main.tsx
RUN npm ci --no-audit --no-fund
COPY tsm-console/. .
# Repo-root inputs imported by the Vite build. Single source of truth lives
# at the repo root; mirrored to /app/<path> so the source imports resolve.
COPY data/scenarios/1937-ohio-river-flood.json \
     data/scenarios/q100-design-event.json \
     data/scenarios/live-gauge-driven.json \
     /app/data/scenarios/
COPY data/schemas/flood-sim-scenario.schema.json /app/data/schemas/flood-sim-scenario.schema.json
COPY artifacts/tsm-geospatial-tile-fabric-v1.json \
     artifacts/tsm-river-valley-realtime-stations-v1.json \
     /app/artifacts/
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/tsm-console/package.json /app/tsm-console/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/tsm-console/server ./server
COPY --from=build /app/tsm-console/data ./data
COPY --from=build /app/tsm-console/data/authority/tsm-authority-registry-v35.json ./tsm-authority-registry-v35.json
COPY --from=build /app/tsm-console/dist ./dist
COPY --from=build /app/tsm-console/index.html ./index.html
RUN addgroup -S tsm && adduser -S -G tsm tsm && mkdir -p /app/.data && chown -R tsm:tsm /app
USER tsm
EXPOSE 8787 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=12 CMD wget -qO- http://127.0.0.1:8787/ready >/dev/null || exit 1
CMD ["node", "server/token-proxy.mjs"]
