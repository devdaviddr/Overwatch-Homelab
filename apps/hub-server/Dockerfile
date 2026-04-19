# Builder stage
FROM node:20-slim AS builder
WORKDIR /usr/src/app

# Install deps (prefer npm ci when lockfile present)
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run db:generate || true
RUN npm run build

# Runtime stage
FROM node:20-slim AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3001
CMD ["node","dist/index.js"]
