# Builder stage (workspace-aware)
FROM node:20-slim AS builder
WORKDIR /usr/src/app

# Empty string = use relative paths so nginx proxy handles routing
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/hub-client/package.json ./apps/hub-client/package.json

RUN npm install --workspaces --no-audit --no-fund

COPY . .
WORKDIR /usr/src/app/apps/hub-client
RUN npm run build

# Serve with nginx
FROM nginx:alpine
COPY --from=builder /usr/src/app/apps/hub-client/dist /usr/share/nginx/html
COPY apps/hub-client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
