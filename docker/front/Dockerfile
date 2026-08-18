# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine

FROM node:${NODE_VERSION} AS build

WORKDIR /app/frontend

RUN npm install -g npm@11.6.2

COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci

COPY frontend ./

RUN npm run build

FROM nginx:${NGINX_VERSION} AS prod

COPY --from=build /app/frontend/build /usr/share/nginx/html

COPY docker/front/nginx/prod.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1