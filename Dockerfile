# syntax=docker/dockerfile:1

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
# O query engine do Prisma (target linux-musl-openssl-3.0.x) precisa do OpenSSL.
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts=false

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
