# web/Dockerfile

# Stage 1: build the application
FROM node:20.11.1-alpine AS build
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Install dependencies (use cache efficiently)
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:1.27.2-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
USER 101
HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1
