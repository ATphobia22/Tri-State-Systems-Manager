FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# Mount or COPY pre-built 256×256 Terrain-RGB XYZ tree:
#   /app/tiles/{z}/{x}/{y}.png
VOLUME /app/tiles

ENV PORT=8080
ENV TILE_DIR=/app/tiles

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.js"]
