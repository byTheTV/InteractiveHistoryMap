FROM node:20-alpine AS builder
WORKDIR /src
COPY frontend ./frontend
COPY index.html ./

FROM nginx:1.25-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /src /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/site.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]