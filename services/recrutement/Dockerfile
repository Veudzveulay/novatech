# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && mkdir -p /app/certs \
    && curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
      https://truststore.pki.rds.amazonaws.com/eu-west-3/eu-west-3-bundle.pem \
      --output /app/certs/eu-west-3-bundle.pem \
    && chmod 0444 /app/certs/eu-west-3-bundle.pem \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --omit=dev \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --chown=node:node src ./src

USER node
EXPOSE 3004
CMD ["node", "src/server.js"]
