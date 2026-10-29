# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# 클라우드 프록시 CA는 빌드 비밀 마운트로만 사용하며 이미지에 저장하지 않는다.
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund --strict-ssl=true

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
ARG APP_REVISION=unknown
WORKDIR /app
ENV APP_REVISION=$APP_REVISION
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S hub && adduser -S hub -G hub
COPY --from=build --chown=hub:hub /app/.next/standalone ./
COPY --from=build --chown=hub:hub /app/.next/static ./.next/static
COPY --from=build --chown=hub:hub /app/public ./public
RUN mkdir -p /app/materials && chown hub:hub /app/materials
USER hub
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
