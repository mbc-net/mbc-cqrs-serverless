FROM node:22-bookworm-slim AS builder

# RUN apk update
# RUN apk --no-cache add make gcc g++ --virtual .builds-deps build-base python3 musl-dev openssl-dev

# Prisma's query engine needs libssl, which bookworm-slim does not ship
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npm run build:prod

FROM node:22-bookworm-slim

# RUN apk update
# RUN apk --no-cache add make gcc g++ --virtual .builds-deps build-base python3 musl-dev openssl-dev

# Prisma's query engine needs libssl, which bookworm-slim does not ship
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# COPY .env .env

CMD ["npm", "run", "start:prod"]
