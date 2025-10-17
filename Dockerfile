FROM node:25-alpine AS builder

WORKDIR /app

# COPY package.json package-lock.json ./
COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM node:25-alpine AS runner

WORKDIR /app

# Curl used for the health checks
RUN apk add --no-cache curl tzdata

# COPY package.json package-lock.json ./
COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

CMD ["npm", "run", "start"]
