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
# Contas (opcional, docs/supabase.md): passe SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e
# SUPABASE_SECRET_KEY ao RODAR o contêiner (não no build: o navegador
# recebe a config pelo /api/config)
EXPOSE 5180
CMD ["node", "server/index.js", "--online"]
