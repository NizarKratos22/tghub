# TG Hub API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t tghub-api .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @tgh/api --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @tgh/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Production dependencies only; sharp picks its Alpine (musl) binary here.
RUN npm ci --omit=dev --workspace @tgh/api && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
RUN mkdir -p /data/media && chown -R node:node /data
WORKDIR /repo/apps/api
USER node
ENV MEDIA_DIR=/data/media PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/main.js"]
