# Builder stage
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --silent || npm install --silent

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-slim AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

CMD ["node","dist/index.js"]
