# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------------------
# service-conges — Dockerfile multi-stage (base / dev / staging / prod)
# Build : docker build --target prod -t novatech/service-conges:prod .
#         docker build --target dev  -t novatech/service-conges:dev  .
# ----------------------------------------------------------------------------

ARG NODE_VERSION=20-alpine

# ---- base : dépendances communes, utilisées par tous les stages -----------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
# utilisateur non-root dès la base (bonne pratique sécurité, relevé par l'audit)
RUN addgroup -S novatech && adduser -S novatech -G novatech
COPY package.json package-lock.json ./

# ---- dependencies : install complet (dev + prod) pour lint/test/build -----
FROM base AS dependencies
RUN npm ci

# ---- dev : environnement de développement local (hot reload) -------------
FROM dependencies AS dev
ENV NODE_ENV=development
COPY . .
USER novatech
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- test : image utilisée par le stage CI "Tests" -------------------------
FROM dependencies AS test
ENV NODE_ENV=test
COPY . .
RUN npm run lint && npm run typecheck
CMD ["npm", "run", "test", "--", "--coverage"]

# ---- build : compilation / transpilation avant packaging prod --------------
FROM dependencies AS build
COPY . .
RUN npm run build

# ---- prod-deps : uniquement les dépendances de production ------------------
FROM base AS prod-deps
RUN npm ci --omit=dev

# ---- staging : image quasi-identique à prod, utilisée en environnement staging
FROM prod-deps AS staging
ENV NODE_ENV=staging
COPY --from=build /app/dist ./dist
USER novatech
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]

# ---- prod : image finale, minimale, exécutée en production -----------------
FROM prod-deps AS prod
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
USER novatech
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
