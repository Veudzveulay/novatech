# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && mkdir -p /app/certs \
    && curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
      https://truststore.pki.rds.amazonaws.com/eu-west-3/eu-west-3-bundle.pem \
      --output /app/certs/eu-west-3-bundle.pem \
    && chmod 0444 /app/certs/eu-west-3-bundle.pem \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3001

CMD ["node", "src/server.js"]
