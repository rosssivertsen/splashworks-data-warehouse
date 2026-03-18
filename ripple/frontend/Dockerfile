# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app
COPY ripple/frontend/package.json ./
RUN npm install
COPY ripple/frontend/ .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY ripple/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
