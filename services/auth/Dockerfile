# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-package-lock

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3001

CMD ["npm", "start"]
