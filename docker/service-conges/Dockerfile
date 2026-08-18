# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS prod

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

RUN addgroup -S app && adduser -S app -G app

COPY services/conges ./services/conges

RUN chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV CONGES_PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "services/conges/src/server.js"]