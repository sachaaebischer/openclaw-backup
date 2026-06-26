# Single image for both services (web + fetcher). docker-compose picks the command.
FROM node:22-alpine AS build
WORKDIR /app

# Install deps with the workspace manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY lib/package.json lib/
COPY apps/web/package.json apps/web/
COPY apps/fetcher/package.json apps/fetcher/
RUN npm ci

COPY . .
RUN npm run build --workspace @coach/lib \
 && npm run build --workspace @coach/web

# data/ and config/ are provided at runtime via volumes.
ENV NODE_ENV=production
EXPOSE 3000

# Default command (overridden per-service in docker-compose.yml).
CMD ["npm", "run", "start", "--workspace", "@coach/web"]
