# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3001

CMD ["node", "src/server.js"]
