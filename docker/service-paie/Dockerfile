# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS prod

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY services/paie ./services/paie

ENV NODE_ENV=production
ENV PAIE_PORT=3002

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "services/paie/src/server.js"]