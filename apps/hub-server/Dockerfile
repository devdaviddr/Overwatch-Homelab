# Builder stage (workspace-aware)
FROM node:20-slim AS builder
WORKDIR /usr/src/app

# Copy root workspace manifests so local packages can be installed
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/hub-server/package.json ./apps/hub-server/package.json

# Install workspaces (includes local @overwatch/shared-types)
RUN npm install --workspaces --no-audit --no-fund

# Copy full repo and build the server
COPY . .
WORKDIR /usr/src/app/apps/hub-server
RUN npm run db:generate || true
RUN npm run build

# Runtime stage
FROM node:20-slim AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Copy root node_modules (workspace installs), packages, and built server
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages ./packages
COPY --from=builder /usr/src/app/apps/hub-server/dist ./apps/hub-server/dist

WORKDIR /usr/src/app/apps/hub-server
EXPOSE 3001
CMD ["node","dist/index.js"]
