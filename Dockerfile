# syntax=docker/dockerfile:1
# Bikefit as a static site: build with Node, serve with unprivileged nginx on :8080.
# The build uses relative paths, so BASE_PATH only decides where nginx serves it.
#   docker build -t bikefit .                                # served at /
#   docker build --build-arg BASE_PATH=/bikefit/ -t bikefit .   # served at /bikefit/

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.29-alpine
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html${BASE_PATH}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:8080/healthz || exit 1
