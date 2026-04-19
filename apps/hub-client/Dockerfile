# Builder stage
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --silent || npm install --silent

COPY . .
RUN npm run build

# Serve with nginx
FROM nginx:alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
