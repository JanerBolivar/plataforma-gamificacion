# Etapa de construccion y compilacion
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Etapa de ejecucion en produccion
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]
