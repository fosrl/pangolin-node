FROM node:22-alpine AS builder

WORKDIR /app

ARG BUILD=oss
ARG DATABASE=sqlite

# COPY package.json package-lock.json ./
COPY package*.json ./
RUN npm ci

COPY . .

RUN echo "export * from \"./$DATABASE\";" > server/db/index.ts

RUN echo "export const build = \"$BUILD\" as any;" > server/build.ts

RUN if [ "$DATABASE" = "pg" ]; then npx drizzle-kit generate --dialect postgresql --schema ./server/db/pg/schema.ts --out init; else npx drizzle-kit generate --dialect $DATABASE --schema ./server/db/$DATABASE/schema.ts --out init; fi

RUN npm run build:$DATABASE
RUN npm run build:cli

FROM node:22-alpine AS runner

WORKDIR /app

# Curl used for the health checks
RUN apk add --no-cache curl tzdata

# COPY package.json package-lock.json ./
COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/init ./dist/init

COPY ./cli/wrapper.sh /usr/local/bin/pangctl
RUN chmod +x /usr/local/bin/pangctl ./dist/cli.mjs

COPY server/db/names.json ./dist/names.json
COPY public ./public

CMD ["npm", "run", "start"]
