# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------------------
# front (React 18) — Dockerfile multi-stage (dev / build / staging / prod)
# ----------------------------------------------------------------------------

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine

# ---- base -------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ---- dependencies ------------------------------------------------------------
FROM base AS dependencies
RUN npm ci

# ---- dev : serveur de dev avec hot reload ------------------------------------
FROM dependencies AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ---- test : lint + type-check + tests unitaires front ------------------------
FROM dependencies AS test
ENV NODE_ENV=test
COPY . .
RUN npm run lint && npm run typecheck
CMD ["npm", "run", "test", "--", "--coverage"]

# ---- build : génération du bundle statique -----------------------------------
FROM dependencies AS build
COPY . .
RUN npm run build

# ---- staging : Nginx servant le build, config staging (feature flags visibles)
FROM nginx:${NGINX_VERSION} AS staging
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/staging.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost/ || exit 1
EXPOSE 80

# ---- prod : Nginx minimal, cache long, headers sécurité ----------------------
FROM nginx:${NGINX_VERSION} AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/prod.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost/ || exit 1
EXPOSE 80
