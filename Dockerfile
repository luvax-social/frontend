FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_SITE_URL
ARG VITE_SEO_INDEXABLE=false
ENV VITE_SITE_URL=${VITE_SITE_URL}
ENV VITE_SEO_INDEXABLE=${VITE_SEO_INDEXABLE}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
