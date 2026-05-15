# Pyonair Mobile App - Web Export Deployment
# Multi-stage build: builds the Expo web export, then serves via nginx

FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (canvas)
RUN apk add --no-cache python3 make g++ pkgconf pixman-dev cairo-dev pango-dev libjpeg-turbo-dev giflib-dev

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build web export
COPY . .
RUN npx expo export --platform web

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built web export
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
