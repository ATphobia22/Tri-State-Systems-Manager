FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY providers ./providers
COPY plugins ./plugins
RUN npm install --ignore-scripts
RUN npm run build:uacf

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
CMD ["node", "--version"]
