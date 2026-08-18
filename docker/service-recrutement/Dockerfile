# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS prod

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

RUN addgroup -S app && adduser -S app -G app

COPY services/recrutement ./services/recrutement

RUN chown -R app:app /app && mkdir -p /tmp/uploads && chown -R app:app /tmp/uploads
USER app

ENV NODE_ENV=production
ENV RECRUTEMENT_PORT=3004
ENV UPLOAD_DIR=/tmp/uploads

EXPOSE 3004

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1

CMD ["node", "services/recrutement/src/server.js"]