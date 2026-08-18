# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS prod

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY services/api-gateway ./services/api-gateway

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "services/api-gateway/src/server.js"]