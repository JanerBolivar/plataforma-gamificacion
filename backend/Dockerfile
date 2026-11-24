# Etapa de construccion y compilacion
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema necesarias para Prisma en Alpine Linux
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Etapa de ejecucion en produccion
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instalar OpenSSL y libc6-compat requeridos por el schema engine de Prisma en ejecucion
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/data ./dist/data
COPY --from=builder /app/src/data ./src/data

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
