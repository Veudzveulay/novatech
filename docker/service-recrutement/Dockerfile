# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS prod

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY services/recrutement ./services/recrutement

ENV NODE_ENV=production
ENV RECRUTEMENT_PORT=3004
ENV UPLOAD_DIR=/tmp/uploads

RUN mkdir -p /tmp/uploads

EXPOSE 3004

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1

CMD ["node", "services/recrutement/src/server.js"]