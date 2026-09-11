# RNF-10: frontend reproducible — Qué: build Vite + serve con nginx + HTTPS en prod (Render/Vercel da TLS 1.3). Por qué: reproducible y HTTPS.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
