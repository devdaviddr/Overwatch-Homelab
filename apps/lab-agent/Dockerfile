# Builder stage (workspace-aware)
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm install --workspaces --no-audit --no-fund

COPY . .
# Build all workspaces (ensures packages/shared-types is compiled)
RUN npm run build --if-present

WORKDIR /usr/src/app/apps/lab-agent
RUN npm run build

# Runtime stage
FROM node:20-slim AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages ./packages
COPY --from=builder /usr/src/app/apps/lab-agent/dist ./apps/lab-agent/dist

WORKDIR /usr/src/app/apps/lab-agent
CMD ["node","dist/index.js"]
