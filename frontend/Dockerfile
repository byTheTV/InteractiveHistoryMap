FROM node:20-alpine AS builder
WORKDIR /src
COPY frontend ./frontend
COPY index.html ./

FROM nginx:1.25-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /src /usr/share/nginx/html
COPY <<'NGINXCONF' /etc/nginx/conf.d/site.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;

    gzip on;
    gzip_types text/css application/javascript application/json text/plain;

    location / {
        try_files $uri $uri/ =404;
    }
}
NGINXCONF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
