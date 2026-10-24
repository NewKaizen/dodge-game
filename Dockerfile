# Servidor do modo ONLINE (docs/online.md): compila o jogo e serve o dist/ com
# o lobby. Qualquer hospedagem de contêiner (Render, Railway, Fly.io, VPS).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 5180
CMD ["node", "server/index.js", "--online"]
