# ---------- Stage 1: Build (Node 20 + Yarn + CRACO) ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Backend URL is baked into the build (CRA env vars are compile-time).
# Empty value => api.js produces "/api" (same-origin via Nginx proxy).
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

# Install deps first for better cache.
# Only copy package.json (not yarn.lock) so builds succeed whether or not the lockfile
# is present in the repo. Emergent regenerates yarn.lock on the fly locally, so we don't
# rely on it inside the image.
COPY package.json ./
RUN yarn install --network-timeout 600000

# Copy sources and build
COPY . .
RUN yarn build

# ---------- Stage 2: Serve (Nginx) ----------
FROM nginx:1.27-alpine

# Drop default site, install ours
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/relaylab.conf

# Copy built static files
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/ > /dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
