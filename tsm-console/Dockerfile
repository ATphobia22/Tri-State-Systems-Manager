# TSM production runtime image
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/postinstall-check.mjs ./scripts/postinstall-check.mjs
COPY vite.config.ts index.html ./
COPY src/main.tsx ./src/main.tsx
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/index.html ./index.html
RUN addgroup -S tsm && adduser -S -G tsm tsm && mkdir -p /app/.data && chown -R tsm:tsm /app
USER tsm
EXPOSE 8787 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=12 CMD wget -qO- http://127.0.0.1:8787/ready >/dev/null || exit 1
CMD ["node", "server/token-proxy.mjs"]
