# Production image: builds the website, then runs the API, which also serves the site.
# Built by deploy/docker-compose.yml; see deploy/README.md.

# ---- build the website ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* values are baked into the browser bundle at build time. They are public by design
# (Auth0 SPA settings); never pass secrets here.
ARG VITE_authDomain
ARG VITE_authClientID
ARG VITE_redirectURL
ARG VITE_authApiAudience
ARG VITE_axiosBaseUrl=/api
ENV VITE_authDomain=$VITE_authDomain \
    VITE_authClientID=$VITE_authClientID \
    VITE_redirectURL=$VITE_redirectURL \
    VITE_authApiAudience=$VITE_authApiAudience \
    VITE_axiosBaseUrl=$VITE_axiosBaseUrl
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY app.js server.js db-connections.js ./
COPY api ./api
COPY shared ./shared
COPY scripts/migrate.js scripts/connect.js ./scripts/
COPY db/migrations ./db/migrations
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
# apply any new database migrations, then start
CMD ["sh", "-c", "node scripts/migrate.js && exec node server.js"]
