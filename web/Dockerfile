# web/Dockerfile

# Stage 1: build the application
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies required for the build
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source files and build the production assets
COPY . .
RUN npm run build

# Stage 2: serve the compiled assets with nginx
FROM nginx:1.27-alpine
RUN apk --no-cache upgrade
COPY --chown=nginx:nginx --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://localhost/ || exit 1
